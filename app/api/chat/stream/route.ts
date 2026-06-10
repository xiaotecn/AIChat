import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveChatProvider, estimateTokens, type ResolvedProvider } from "@/lib/ai"
import { getSession } from "@/lib/auth"
import { maybeResetUsage, maybeExpireSubscription } from "@/lib/quota"
import { matchKeywordRule, resolveGroupModels, recordLatency } from "@/lib/groups"
import { persistImage } from "@/lib/image-store"

type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }

interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string | ChatContentPart[]
}

// 故障转移候选：modelId 锁定具体渠道的模型（分组成员各自所属渠道）；code 用于非分组 / 兜底。
type Candidate = { modelId?: string | null; code?: string }

// 末条用户消息：vision 分组且带图 → 多模态数组（文本 + 各图 image_url）；否则纯文本（行为不变）。
function buildUserMessage(text: string, images: string[]): ChatMessage {
  if (images.length === 0) return { role: "user", content: text }
  return {
    role: "user",
    content: [
      { type: "text", text },
      ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
    ],
  }
}

// 把消息 content（可能是多模态数组）拍平成纯文本，用于 token 估算 / 日志。
function contentToText(content: string | ChatContentPart[]): string {
  if (typeof content === "string") return content
  return content.map((p) => (p.type === "text" ? p.text : "")).join("")
}

// 生图是「同步挂住连接直到出图」的慢请求（常见 2–4 分钟，故 180s 远不够）。
// 给足 10 分钟上限兜底，避免上游不结束导致路由永久挂起；正常出图远在此之前。
// 注：Node 内置 fetch(undici) 自身还有 ~300s 的 body 读超时，无法在不引入 undici 包的情况下覆盖；
// 若个别模型单张耗时逼近/超过 5 分钟，会先被它掐断（日志显示「生图读取响应失败」），届时再单独处理。
const IMAGE_GEN_TIMEOUT_MS = 600_000

// 流式聊天：分组（关键词预设 / 轮询 + 故障转移）→ 单模型 → 环境变量 → 模拟响应。
// 向后兼容：body.model 既可能是分组 id，也可能是旧的模型码；先按分组 id 查，查不到当模型码。
export async function POST(request: NextRequest) {
  try {
    // 从会话识别用户（不信任客户端传入的身份）
    const session = await getSession()
    if (!session) {
      return new Response(JSON.stringify({ error: "未登录" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const body = await request.json()
    const message: string = body.message
    const conversationId: string | undefined = body.conversationId
    // body.model 可能是分组 id 或旧模型码（向后兼容）
    const modelOrGroup: string | undefined = body.model
    const userLabel: string = session.email
    // 客户端可传入历史消息以支持多轮上下文
    const history: ChatMessage[] = Array.isArray(body.history) ? body.history : []
    // vision 分组：客户端可带「当前轮」图片（data URI 数组，最多 4 张）发给视觉模型；
    // 历史仍是纯文本，不重发历史图（避免每轮 token 膨胀）。
    const images: string[] = Array.isArray(body.images)
      ? body.images.filter((u: unknown): u is string => typeof u === "string" && u.length > 0).slice(0, 4)
      : []

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // 解析用户（含套餐）并做惰性过期回退 + 周期重置：新周期已到则清零，避免老用户被永久锁死
    const userRaw = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { plan: true },
    })
    const userExpired = userRaw ? await maybeExpireSubscription(userRaw) : null
    const user = userExpired ? await maybeResetUsage(userExpired) : null

    // ── 分组解析：body.model 是分组 id？（查不到则为 null，按旧模型码走） ──
    // 上移到额度校验之前：生图分组与普通对话走不同的额度维度。
    const group = modelOrGroup
      ? await prisma.modelGroup.findUnique({ where: { id: modelOrGroup } })
      : null

    // 额度校验（限额 -1 表示不限）：
    //  · 生图分组 → 只看「图片张数」额度（imageLimit / usedImages），不查 token/消息
    //  · 普通对话 → 看「消息数 / token」额度
    if (user?.plan) {
      if (group?.imageGen) {
        if (user.plan.imageLimit >= 0 && user.usedImages >= user.plan.imageLimit) {
          return new Response(
            JSON.stringify({ error: "本周期图片生成次数已达上限，请升级套餐或等待重置" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          )
        }
      } else {
        if (user.plan.messageLimit >= 0 && user.usedMessages >= user.plan.messageLimit) {
          return new Response(
            JSON.stringify({ error: "本周期消息数已达上限，请升级套餐或等待重置" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          )
        }
        // Token 限制默认关闭——现按「消息数(可设为每日)」限流；usedTokens 仍照常累计供统计展示（数据继续）。
        // 如需恢复按 token 限制，设环境变量 CHAT_ENFORCE_TOKEN_LIMIT=true。
        if (
          process.env.CHAT_ENFORCE_TOKEN_LIMIT === "true" &&
          user.plan.tokenLimit >= 0 &&
          user.usedTokens >= user.plan.tokenLimit
        ) {
          return new Response(
            JSON.stringify({ error: "额度已用尽，请升级套餐或等待重置" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          )
        }
      }
    }

    // 候选列表：决定故障转移依次尝试哪些「渠道内的具体模型」。携带 modelId 锁定渠道，避免同名 code 串渠道。
    let candidates: Candidate[]
    if (group) {
      // 关键词前置：命中则直接吐预设回复，不调用任何大模型
      const hit = await matchKeywordRule(group.id, message)
      if (hit) {
        return streamCannedReply(hit.reply, group.name, session.userId, userLabel)
      }
      const groupModels = await resolveGroupModels(group.id)
      if (groupModels.length > 0) {
        // 按持久化 cursor 轮转起点，得到本次候选顺序；游标 +1（fire-and-forget）
        candidates = rotate(
          groupModels.map((m) => ({ modelId: m.modelId, code: m.code })),
          group.cursor
        )
        prisma.modelGroup
          .update({ where: { id: group.id }, data: { cursor: { increment: 1 } } })
          .catch(() => {})
      } else {
        // 空分组：退回「首个可用提供商」
        candidates = [{}]
      }

      // 图片生成分组：改为「后台任务」——先把 pending 助手消息落库，后台异步生成并落库 done/error，
      // 立即返回 jobId 供前端轮询。脱离本连接，玩家离开/断网也照常生成，回来直接拿到图。
      if (group.imageGen) {
        return startImageJob(conversationId, candidates, message, session.userId, userLabel)
      }
    } else {
      // 非分组：按原模型码（或 undefined）走单次解析
      candidates = [{ code: modelOrGroup }]
    }

    // 组装发送给模型的消息（历史 + 本轮用户消息）
    const messages: ChatMessage[] = [
      // 系统提示词（人设/规则）：分组配了 systemPrompt 就作为首条 system 消息，用于锁定身份/防套话
      ...(group?.systemPrompt?.trim()
        ? [{ role: "system" as const, content: group.systemPrompt.trim() }]
        : []),
      ...history
        .filter((m) => m && m.content && (m.role === "user" || m.role === "assistant"))
        .slice(-20) // 限制上下文长度，避免超出模型窗口
        .map((m) => ({ role: m.role, content: m.content })),
      // 末条用户消息：vision 分组且带图时用多模态数组，否则纯文本（行为不变）
      buildUserMessage(message, group?.vision ? images : []),
    ]

    // ── 故障转移循环：依次尝试候选模型，首个成功者选定并流式返回 ──
    // 最多尝试 min(候选数, 4) 个，避免组很大时一次请求耗时过长。
    const maxTries = Math.min(candidates.length, 4)
    let lastProvider: ResolvedProvider | null = null
    for (let i = 0; i < maxTries; i++) {
      const provider = await resolveChatProvider(candidates[i].code, candidates[i].modelId)
      lastProvider = provider
      // 完全未配置任何提供商：后续候选同样无解，直接跳出走模拟响应
      if (provider.source === "none") break

      const startedAt = Date.now()
      let upstream: Response
      try {
        upstream = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify({
            model: provider.model,
            messages,
            stream: true,
            stream_options: { include_usage: true },
          }),
        })
      } catch (e) {
        await logApiCall({
          provider,
          userLabel,
          status: "error",
          tokens: 0,
          message: `请求失败: ${(e as Error).message}`,
        })
        continue // 尝试下一个候选
      }

      if (!upstream.ok || !upstream.body) {
        const errText = await upstream.text().catch(() => "")
        await logApiCall({
          provider,
          userLabel,
          status: "error",
          tokens: 0,
          message: `上游错误 ${upstream.status}: ${errText.slice(0, 200)}`,
        })
        continue // 故障转移：尝试下一个候选
      }

      // 成功拿到响应头：记录该模型延迟（EMA，fire-and-forget），流式返回
      recordLatency(provider.modelId, Date.now() - startedAt)
      return buildStreamResponse(upstream, provider, messages, session.userId, userLabel)
    }

    // 全部候选失败 / 未配置提供商 → 简短「服务器不可用」提示（不计用量）
    const fallback =
      lastProvider ?? (await resolveChatProvider(candidates[0]?.code, candidates[0]?.modelId))
    return streamUnavailable(fallback, userLabel)
  } catch (error) {
    console.error("Chat stream API error:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

/** 把数组从下标 start 处旋转（环形）：rotate([a,b,c],1) => [b,c,a]。用于轮询起点。 */
function rotate<T>(arr: T[], start: number): T[] {
  const n = arr.length
  if (n === 0) return arr
  const s = ((Math.trunc(start) % n) + n) % n
  return [...arr.slice(s), ...arr.slice(0, s)]
}

/**
 * 已确认 upstream.ok 后，构建读取上游 SSE 并增量转发给客户端的流式 Response。
 * 关闭时记录调用日志并按额度单价扣减用量。供故障转移循环里被选中的候选复用。
 */
function buildStreamResponse(
  upstream: Response,
  provider: ResolvedProvider,
  messages: ChatMessage[],
  userId: string,
  userLabel: string
) {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let fullContent = ""
  let reportedTokens = 0
  let buffer = ""

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          // SSE 事件以换行分隔；逐行解析，未完成的行留在 buffer 中
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const raw of lines) {
            const line = raw.trim()
            if (!line.startsWith("data:")) continue
            const data = line.slice(5).trim()
            if (data === "[DONE]") continue

            try {
              const json = JSON.parse(data)
              const content = json.choices?.[0]?.delta?.content
              if (content) {
                fullContent += content
                controller.enqueue(encoder.encode(content))
              }
              // OpenAI 在 include_usage 时于最后一帧返回 usage
              if (json.usage?.total_tokens) {
                reportedTokens = json.usage.total_tokens
              }
            } catch {
              // 忽略无法解析的分片
            }
          }
        }
      } finally {
        reader.releaseLock()
        controller.close()

        const tokens =
          reportedTokens ||
          estimateTokens(messages.map((m) => contentToText(m.content)).join("") + fullContent)

        // 记录调用日志 + 按额度单价加权扣减用量（不阻塞响应关闭）
        await logApiCall({
          provider,
          userLabel,
          status: "success",
          tokens,
          message: `${fullContent.length} 字符`,
        })
        await bumpUserUsage(userId, tokens, provider.price)
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  })
}

async function logApiCall(opts: {
  provider: { providerId: string | null; providerName: string; model: string }
  userLabel: string
  status: string
  tokens: number
  message: string
  action?: string
}) {
  try {
    await prisma.apiLog.create({
      data: {
        providerId: opts.provider.providerId ?? "env",
        providerName: opts.provider.providerName,
        model: opts.provider.model,
        user: opts.userLabel,
        action: opts.action ?? "chat.completion",
        tokens: opts.tokens,
        status: opts.status,
        message: opts.message,
      },
    })
  } catch (e) {
    console.error("Failed to write ApiLog:", e)
  }
}

// 按额度单价加权扣减：usedTokens += round(tokens × price)，usedMessages += 1
async function bumpUserUsage(userId: string, tokens: number, price: number) {
  if (!userId) return
  const quotaCost = Math.max(1, Math.round(tokens * (price || 1)))
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        usedTokens: { increment: quotaCost },
        usedMessages: { increment: 1 },
      },
    })
  } catch (e) {
    console.error("Failed to update user usage:", e)
  }
}

// 生图额度扣减：仅 usedImages += 1，不动 token / 消息（生图走独立的「图片张数」额度）
async function bumpUserImages(userId: string) {
  if (!userId) return
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { usedImages: { increment: 1 } },
    })
  } catch (e) {
    console.error("Failed to update user image usage:", e)
  }
}

/**
 * 关键词命中：仿模拟响应的节奏（逐字 ~8ms）吐出预设回复，不调用任何大模型。
 * 关闭时记录一条 model="keyword-rule" 的日志，并计 1 条消息、按回复估算 tokens、price=1。
 */
function streamCannedReply(
  reply: string,
  groupName: string,
  userId: string,
  userLabel: string
) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      for (const char of reply) {
        controller.enqueue(encoder.encode(char))
        await new Promise((resolve) => setTimeout(resolve, 8))
      }
      controller.close()

      const tokens = estimateTokens(reply)
      await logApiCall({
        provider: {
          providerId: "keyword-rule",
          providerName: groupName,
          model: "keyword-rule",
        },
        userLabel,
        status: "success",
        tokens,
        message: `(关键词) ${reply.length} 字符`,
      })
      await bumpUserUsage(userId, tokens, 1)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  })
}

// 从上游(生图)错误响应里提取人类可读消息；若命中「内容违规/审核不通过」类关键词，
// 返回该原因用于直接回显给用户（其余普通错误仍走通用失败文案）。
function extractViolationReason(raw: string): string | null {
  let msg = ""
  try {
    const j = JSON.parse(raw)
    msg = (j?.error?.message || j?.message || (typeof j?.error === "string" ? j.error : "") || "").toString()
  } catch {
    msg = raw
  }
  msg = msg.trim()
  if (!msg) return null
  const re =
    /违规|违禁|敏感|涉黄|涉政|涉暴|不良|不当|审核未?通过|内容安全|风控|safety|content[\s_-]?policy|moderation|rejected|blocked|nsfw|sensitive|prohibited|violat/i
  if (!re.test(msg)) return null
  return msg.length > 200 ? msg.slice(0, 200) + "…" : msg
}

/**
 * 生图故障转移循环（被 startImageJob 在后台调用）：把用户消息当 prompt，依次尝试候选模型
 * 调用 /images/generations（同步、可能 2–4 分钟）。内部完成日志与延迟记录，返回「最终要展示的
 * 文本」——成功为图片 Markdown，失败为提示文案。额度的预扣 / 退还由调用方 startImageJob 负责。
 */
async function runImageGenLoop(
  candidates: Candidate[],
  prompt: string,
  userLabel: string
): Promise<string> {
  const maxTries = Math.min(candidates.length, 4)
  let lastProvider: ResolvedProvider | null = null
  for (let i = 0; i < maxTries; i++) {
    const provider = await resolveChatProvider(candidates[i].code, candidates[i].modelId)
    lastProvider = provider
    // 完全未配置任何提供商：后续候选同样无解
    if (provider.source === "none") break

    const startedAt = Date.now()
    // 生图是「同步挂住连接直到出图」的慢请求（常见 2–4 分钟）；用 AbortController 兜底超时，
    // 既管控握手阶段，也管控读体阶段，避免上游迟迟不结束导致路由永久挂起、
    // 前端永远停在「正在思考…」且无任何日志。
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), IMAGE_GEN_TIMEOUT_MS)
    let upstream: Response
    try {
      upstream = await fetch(`${provider.baseUrl}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({ model: provider.model, prompt, n: 1, size: "1024x1024" }),
        signal: controller.signal,
      })
    } catch (e) {
      clearTimeout(timeout)
      const aborted = (e as Error)?.name === "AbortError"
      await logApiCall({
        provider,
        userLabel,
        status: "error",
        tokens: 0,
        message: aborted
          ? `生图超时(>${Math.round(IMAGE_GEN_TIMEOUT_MS / 1000)}s)`
          : `生图请求失败: ${(e as Error).message}`,
        action: "image.generation",
      })
      if (aborted) break // 超时说明上游过慢，不再对下个候选重复空等整个超时
      continue // 网络错误：故障转移到下个候选
    }

    // 统一读为文本再解析：.json() 在异常/不结束的响应体上可能永久 pending（.catch 接不住），
    // 读文本受 signal 管控可被超时中断；并便于在解析失败时记录原始响应片段排查各家接口差异。
    let rawText = ""
    try {
      rawText = await upstream.text()
    } catch (e) {
      clearTimeout(timeout)
      const aborted = (e as Error)?.name === "AbortError"
      await logApiCall({
        provider,
        userLabel,
        status: "error",
        tokens: 0,
        message: aborted
          ? `生图读取超时(>${Math.round(IMAGE_GEN_TIMEOUT_MS / 1000)}s)`
          : `生图读取响应失败: ${(e as Error).message}`,
        action: "image.generation",
      })
      if (aborted) break // 超时说明上游过慢，不再对下个候选重复空等整个超时
      continue
    }
    clearTimeout(timeout)

    if (!upstream.ok) {
      await logApiCall({
        provider,
        userLabel,
        status: "error",
        tokens: 0,
        message: `生图上游错误 ${upstream.status}: ${rawText.slice(0, 200)}`,
        action: "image.generation",
      })
      // 上游明确「内容违规/审核不通过」：换别的候选同样会被拒——把原因直接回显给用户，不再失败转移
      const violation = extractViolationReason(rawText)
      if (violation) return `⚠️ ${violation}`
      continue
    }

    const urls = extractImageUrls(rawText)
    if (urls.length === 0) {
      // 记录原始响应片段，方便对照各家接口的实际返回形态调整解析
      console.error("[image.generation] 无法从响应解析出图片，原始响应：", rawText.slice(0, 1000))
      await logApiCall({
        provider,
        userLabel,
        status: "error",
        tokens: 0,
        message: `生图响应无图片数据: ${rawText.slice(0, 200)}`,
        action: "image.generation",
      })
      // 有的渠道返回 200 但体内是违规提示：同样把违规原因回显给用户
      const violation = extractViolationReason(rawText)
      if (violation) return `⚠️ ${violation}`
      continue
    }

    // 成功：记录延迟（EMA），记日志（tokens 仅作审计估算），返回图片 Markdown。
    // 图片额度由调用方 startImageJob「预扣 / 失败退还」，这里不计数。
    recordLatency(provider.modelId, Date.now() - startedAt)
    // 落盘持久化：上游链接常是临时的（会过期 404），把图片下载到本站后改存站内路径；
    // 同时让数据库不再承载 base64/外链。单张失败则回退到原始地址（至少能即时显示）。
    const stored = await Promise.all(
      urls.map(async (u) => {
        try {
          return await persistImage(u)
        } catch (e) {
          console.error("[image.generation] 图片落盘失败，回退原始地址:", e)
          return u
        }
      })
    )
    const alt = prompt.replace(/[[\]\r\n\f]/g, " ").trim().slice(0, 50) || "image"
    const markdown = stored.map((u) => `![${alt}](${u})`).join("\n\n")
    const tokens = estimateTokens(prompt)
    await logApiCall({
      provider,
      userLabel,
      status: "success",
      tokens,
      message: `(生图) ${markdown.length} 字符`,
      action: "image.generation",
    })
    return markdown
  }

  // 全部候选失败 / 未配置提供商：记错误日志（不扣额度），返回失败文案
  await logApiCall({
    provider: lastProvider ?? { providerId: null, providerName: "未配置", model: "image" },
    userLabel,
    status: "error",
    tokens: 0,
    message: "(生图) 全部候选失败",
    action: "image.generation",
  })
  return "⚠️ 图片生成失败：当前分组没有可用的生图模型，或上游未返回图片。请稍后重试或联系管理员。"
}

/**
 * 从 /images/generations 的原始响应文本解析出图片地址，尽量兼容各家中转接口：
 *  - 标准 OpenAI：{data:[{url}]} 或 {data:[{b64_json}]}
 *  - 变体：顶层或数组项里的 images / output；项可能是字符串或 {url|image|b64|b64_json}
 *  - 顶层直接给 {url} 或 {image}
 *  - 响应是 SSE / 非纯 JSON：兜底用正则从全文扫描 http(s) 图片链接或 data:image URI
 * 解析不出则返回空数组（调用方据此故障转移 / 记错误日志）。
 */
function extractImageUrls(raw: string): string[] {
  const urls: string[] = []
  const b64ToDataUri = (b64: string) => `data:image/png;base64,${b64}`

  const pushItem = (d: unknown) => {
    if (typeof d === "string") {
      if (d) urls.push(d)
      return
    }
    if (!d || typeof d !== "object") return
    const o = d as { url?: string; image?: string; b64_json?: string; b64?: string }
    if (typeof o.url === "string" && o.url) urls.push(o.url)
    else if (typeof o.image === "string" && o.image) urls.push(o.image)
    else if (typeof o.b64_json === "string" && o.b64_json) urls.push(b64ToDataUri(o.b64_json))
    else if (typeof o.b64 === "string" && o.b64) urls.push(b64ToDataUri(o.b64))
  }
  const pushArray = (arr: unknown) => {
    if (Array.isArray(arr)) arr.forEach(pushItem)
  }

  let json: unknown = null
  try {
    json = JSON.parse(raw)
  } catch {
    json = null
  }

  if (json && typeof json === "object") {
    const root = json as Record<string, unknown>
    pushArray(root.data)
    pushArray(root.images)
    pushArray(root.output)
    if (typeof root.url === "string" && root.url) urls.push(root.url)
    if (typeof root.image === "string" && root.image) urls.push(root.image)
  }

  // 兜底：JSON 解析不到（如 SSE、或形态过于特殊）时，从全文正则提取图片链接 / data URI
  if (urls.length === 0) {
    const dataUri = raw.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g)
    if (dataUri) urls.push(...dataUri)
    const httpUrl = raw.match(/https?:\/\/[^\s"'`)\\]+\.(?:png|jpe?g|webp|gif|bmp)(?:\?[^\s"'`)\\]*)?/gi)
    if (httpUrl) urls.push(...httpUrl)
  }

  // 去重 + 过滤空
  return urls.filter(
    (u, i) => typeof u === "string" && u.length > 0 && urls.indexOf(u) === i
  )
}

/**
 * 生图后台任务入口：先把一条 status="pending" 的助手消息落库（前端立刻能看到「生成中」占位，
 * 且这条记录与本 HTTP 连接无关——玩家离开 / 断网 / 切后台都不影响），并预扣 1 张图片额度；
 * 随后在后台异步跑生成循环，完成时把该消息更新为 done(图片) / error(失败并退还额度)。立即返回 jobId。
 *
 * 额度「预扣 / 退还」而非「成功才扣」：异步化后用户可连发多条，必须在开始时占位防止超额。
 * 依赖「常驻 Node 服务」——后台 promise 能活过响应；若部署到 serverless（响应后即冻结），
 * 需改用真正的任务队列 + worker。
 */
async function startImageJob(
  conversationId: string | undefined,
  candidates: Candidate[],
  prompt: string,
  userId: string,
  userLabel: string
): Promise<Response> {
  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

  if (!conversationId) return json({ error: "缺少会话 id" }, 400)

  // 归属校验：只能往本人的会话写
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { userId: true },
  })
  if (!conv || conv.userId !== userId) return json({ error: "无权操作该会话" }, 403)

  // 落库 pending 占位 + 预扣 1 张额度
  const pending = await prisma.message.create({
    data: { conversationId, role: "assistant", content: "🎨 正在生成图片中…", status: "pending" },
  })
  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
  await bumpUserImages(userId)

  // 后台异步生成（脱离本请求连接）：成功落库图片；失败标 error 并退还预扣额度
  void runImageGenLoop(candidates, prompt, userLabel)
    .then(async (result) => {
      const failed = result.startsWith("⚠️")
      await prisma.message.update({
        where: { id: pending.id },
        data: { content: result, status: failed ? "error" : "done" },
      })
      if (failed) await refundUserImage(userId)
    })
    .catch(async (e) => {
      console.error("startImageJob 后台生成异常:", e)
      await prisma.message
        .update({
          where: { id: pending.id },
          data: { content: "⚠️ 图片生成失败：发生意外错误，请稍后重试。", status: "error" },
        })
        .catch(() => {})
      await refundUserImage(userId)
    })

  return json({ kind: "imageJob", assistantMessageId: pending.id, placeholder: "🎨 正在生成图片中…" })
}

// 退还 1 张预扣的图片额度（仅在 usedImages > 0 时，避免周期重置后被减成负数）
async function refundUserImage(userId: string) {
  if (!userId) return
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { usedImages: true } })
    if (u && u.usedImages > 0) {
      await prisma.user.update({ where: { id: userId }, data: { usedImages: { decrement: 1 } } })
    }
  } catch (e) {
    console.error("退还图片额度失败:", e)
  }
}

// 兜底响应：未配置可用 AI 服务商 / 所有上游均失败时，回一条简短「服务器不可用」提示。
// 不计入用量（不为失败向用户扣费），仅记一条 error 日志供后台排查。
function streamUnavailable(provider: ResolvedProvider, userLabel: string) {
  const encoder = new TextEncoder()
  const text = "⚠️ 当前服务器不可用，请稍后再试。"

  const stream = new ReadableStream({
    async start(controller) {
      for (const char of text) {
        controller.enqueue(encoder.encode(char))
        await new Promise((resolve) => setTimeout(resolve, 12))
      }
      controller.close()

      await logApiCall({
        provider,
        userLabel,
        status: "error",
        tokens: 0,
        message: "(服务不可用) 未配置可用服务商或全部上游失败",
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  })
}
