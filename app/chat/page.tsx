"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useChatStore } from "@/lib/store"
import { MessageList } from "@/components/chat/message-list"
import { ChatInput } from "@/components/chat/chat-input"
import { ChatHeader } from "@/components/chat/chat-header"
import { toast } from "@/components/ui/toast"
import { generateId } from "@/lib/utils"
import type { Message } from "@/lib/store"

// 持久化一条消息到数据库，返回新建行的 id（供重试时删除旧回复）
async function persistMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  tokens?: number,
  images?: string[]
): Promise<string | undefined> {
  try {
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, role, content, tokens, images }),
    })
    const result = await res.json().catch(() => null)
    return result?.data?.id
  } catch (e) {
    console.error("保存消息失败:", e)
    return undefined
  }
}

// 服务端可用换页符 \f 表示「清空此前内容，仅保留其后」——生图先吐「🎨 正在生成图片中…」进度提示，
// 出图时用它清掉提示只留图片。普通对话从不含 \f，displayContent 原样返回、行为不变。
function displayContent(s: string): string {
  const i = s.lastIndexOf("\f")
  return i >= 0 ? s.slice(i + 1) : s
}

export default function ChatPage() {
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  // 正在轮询的生图任务（按消息 dbId 去重，防止重复轮询同一任务）
  const pollingRef = useRef<Set<string>>(new Set())
  const {
    user,
    conversations,
    activeConversationId,
    selectedModel,
    modelGroups,
    createConversation,
    addMessage,
    updateMessage,
    loadConversations,
    loadMessages,
    loadUser,
    loadModelGroups,
  } = useChatStore()

  const activeConversation = conversations.find((c) => c.id === activeConversationId)
  // 助手头像 = 当前会话所用分组的自定义头像（取不到则为 null，MessageList 回退内置 Bot 图标）
  const currentGroupId = activeConversation?.modelId ?? selectedModel
  const assistantAvatar = modelGroups.find((g) => g.id === currentGroupId)?.avatarUrl ?? null

  // 进入页面时从数据库加载对话列表
  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // 准实时刷新：回到前台时拉一遍（用户额度/可选分组/对话列表），并每 45s 轮询额度与分组，
  // 让后台改动（套餐/额度/分组等）尽快反映到用户页面。真正的即时推送需 WebSocket，按需再加。
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      loadUser()
      loadModelGroups()
      loadConversations()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadUser()
        loadModelGroups()
      }
    }, 45000)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
      clearInterval(timer)
    }
  }, [loadUser, loadModelGroups, loadConversations])

  // 切换/进入对话时按需加载其完整消息
  useEffect(() => {
    if (!activeConversationId) return
    const conv = conversations.find((c) => c.id === activeConversationId)
    if (conv && !conv.messagesLoaded) {
      loadMessages(activeConversationId)
    }
  }, [activeConversationId, conversations, loadMessages])

  // 生图任务轮询：每 ~4s 查一次该助手消息状态，done/error 即落地并停；切后台暂停网络请求；
  // 超 13 分钟兜底停轮询（防服务重启遗留的孤儿 pending）。pollingRef 按 dbId 去重，避免重复轮询。
  const pollImageJob = useCallback(
    (conversationId: string, localMsgId: string, dbId: string) => {
      if (pollingRef.current.has(dbId)) return
      pollingRef.current.add(dbId)
      const deadline = Date.now() + 13 * 60 * 1000
      const tick = async () => {
        if (Date.now() > deadline) {
          updateMessage(conversationId, localMsgId, { content: "⚠️ 图片生成超时，请重试。", status: "error", dbId })
          pollingRef.current.delete(dbId)
          return
        }
        // 切到后台时暂停网络请求，回前台再继续（省电省请求）
        if (typeof document !== "undefined" && document.hidden) {
          setTimeout(tick, 5000)
          return
        }
        try {
          const res = await fetch(`/api/messages/${dbId}`)
          const result = await res.json().catch(() => null)
          const m = result?.data
          if (m?.status === "done") {
            updateMessage(conversationId, localMsgId, { content: m.content, status: "success", dbId })
            pollingRef.current.delete(dbId)
            return
          }
          if (m?.status === "error") {
            updateMessage(conversationId, localMsgId, {
              content: m.content || "⚠️ 图片生成失败，请稍后重试。",
              status: "error",
              dbId,
            })
            pollingRef.current.delete(dbId)
            return
          }
        } catch {
          // 网络抖动：忽略，下一拍再试
        }
        setTimeout(tick, 4000)
      }
      setTimeout(tick, 2000)
    },
    [updateMessage]
  )

  // 续看：会话里若有 pending（status 'sending' 且已落库 dbId）的助手消息——通常是重载后从数据库
  // 恢复的生图任务——自动恢复轮询。玩家离开再回来即可直接拿到图片。（普通流式回复无 dbId，不会误判）
  useEffect(() => {
    const conv = conversations.find((c) => c.id === activeConversationId)
    if (!conv) return
    for (const m of conv.messages) {
      if (m.role === "assistant" && m.status === "sending" && m.dbId) {
        pollImageJob(conv.id, m.id, m.dbId)
      }
    }
  }, [activeConversationId, conversations, pollImageJob])

  // 核心生成流程：调用流式接口，把增量写入指定的 AI 占位消息；支持中止
  const generate = async (
    conversationId: string,
    userContent: string,
    history: { role: string; content: string }[],
    aiMessageId: string,
    images?: string[]
  ) => {
    const controller = new AbortController()
    abortRef.current = controller
    setIsLoading(true)
    let fullContent = ""

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message: userContent,
          model: selectedModel,
          history,
          images,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        // 读取服务端错误信息（额度用尽 / 未登录等）
        let msg = "消息发送失败，请稍后重试。"
        try {
          const j = await response.json()
          if (j?.error) msg = j.error
        } catch {}
        updateMessage(conversationId, aiMessageId, { content: `⚠️ ${msg}`, status: "error" })
        toast.error(msg)
        return
      }

      // 生图分组：服务端已把 pending 助手消息落库并在后台异步生成，返回 JSON 任务句柄。
      // 这里不读流——回填 dbId + 占位，启动轮询，随后释放 isLoading（生成在后台进行，玩家离开也不影响）。
      const contentType = response.headers.get("content-type") || ""
      if (contentType.includes("application/json")) {
        const job = await response.json().catch(() => null)
        if (job?.kind === "imageJob" && job.assistantMessageId) {
          updateMessage(conversationId, aiMessageId, {
            content: job.placeholder || "🎨 正在生成图片中…",
            status: "sending",
            dbId: job.assistantMessageId,
          })
          pollImageJob(conversationId, aiMessageId, job.assistantMessageId)
        } else {
          updateMessage(conversationId, aiMessageId, {
            content: `⚠️ ${job?.error || "图片任务创建失败，请稍后重试。"}`,
            status: "error",
          })
          toast.error(job?.error || "图片任务创建失败")
        }
        return
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullContent += decoder.decode(value, { stream: true })
          // 生图用 \f 清屏：只展示最后一个 \f 之后的内容（进度提示 → 图片）
          updateMessage(conversationId, aiMessageId, { content: displayContent(fullContent), status: "sending" })
        }
      }

      const finalContent = displayContent(fullContent) || "（未收到回复）"
      updateMessage(conversationId, aiMessageId, { content: finalContent, status: "success" })
      const dbId = await persistMessage(conversationId, "assistant", finalContent)
      if (dbId) updateMessage(conversationId, aiMessageId, { dbId })
    } catch (error) {
      if ((error as Error)?.name === "AbortError") {
        // 用户主动停止：保留已生成的部分内容并落库
        const partial = displayContent(fullContent).trim()
        if (partial) {
          updateMessage(conversationId, aiMessageId, { content: partial, status: "success" })
          const dbId = await persistMessage(conversationId, "assistant", partial)
          if (dbId) updateMessage(conversationId, aiMessageId, { dbId })
        } else {
          updateMessage(conversationId, aiMessageId, { content: "（已停止）", status: "error" })
        }
        toast.info("已停止生成")
      } else {
        console.error("Generate error:", error)
        updateMessage(conversationId, aiMessageId, {
          content: "⚠️ 消息发送失败，请稍后重试。",
          status: "error",
        })
        toast.error("消息发送失败")
      }
    } finally {
      abortRef.current = null
      setIsLoading(false)
    }
  }

  const handleSend = async (content: string, images?: string[]) => {
    if (isLoading) return
    let conversationId = activeConversationId
    const existingMessages = activeConversation?.messages ?? []

    // 1. 没有活动会话则在数据库中创建
    if (!conversationId) {
      const base = content.trim() || "图片提问"
      const title = base.slice(0, 30) + (base.length > 30 ? "..." : "")
      const conv = await createConversation(title, selectedModel)
      if (!conv) {
        toast.error("无法创建对话")
        return
      }
      conversationId = conv.id
    }

    // 多轮上下文（排除失败消息）
    const history = existingMessages
      .filter((m) => m.status !== "error")
      .map((m) => ({ role: m.role, content: m.content }))

    // 2. 用户消息：本地展示（图片先用 data URI 即时显示）+ 持久化（服务端把图落盘成站内路径）
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content,
      images: images?.length ? images : undefined,
      createdAt: new Date(),
      status: "success",
    }
    addMessage(conversationId, userMessage)
    const userDbId = await persistMessage(conversationId, "user", content, undefined, images)
    if (userDbId) updateMessage(conversationId, userMessage.id, { dbId: userDbId })

    // 3. AI 占位消息
    const aiMessageId = generateId()
    addMessage(conversationId, {
      id: aiMessageId,
      role: "assistant",
      content: "",
      createdAt: new Date(),
      status: "sending",
    })

    // 4. 生成
    await generate(conversationId, content, history, aiMessageId, images)
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  // 重新生成最后一条助手回复
  const handleRetry = async (assistantId: string) => {
    if (isLoading || !activeConversationId || !activeConversation) return
    const msgs = activeConversation.messages
    const idx = msgs.findIndex((m) => m.id === assistantId)
    if (idx < 1) return

    // 向前找到该回复对应的用户提问
    let userIdx = idx - 1
    while (userIdx >= 0 && msgs[userIdx].role !== "user") userIdx--
    if (userIdx < 0) {
      toast.error("找不到对应的提问")
      return
    }
    const userContent = msgs[userIdx].content
    const history = msgs
      .slice(0, userIdx)
      .filter((m) => m.status !== "error")
      .map((m) => ({ role: m.role, content: m.content }))

    // 删除旧的已持久化回复，避免数据库重复
    const oldDbId = msgs[idx].dbId
    if (oldDbId) {
      try {
        await fetch(`/api/messages/${oldDbId}`, { method: "DELETE" })
      } catch (e) {
        console.error("删除旧回复失败:", e)
      }
    }

    // 复位占位消息并重新生成
    updateMessage(activeConversationId, assistantId, {
      content: "",
      status: "sending",
      dbId: undefined,
    })
    await generate(activeConversationId, userContent, history, assistantId)
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-950">
      {/* 顶部导航 */}
      <ChatHeader />

      {/* 消息列表 */}
      <MessageList
        messages={activeConversation?.messages || []}
        onRetry={handleRetry}
        isLoading={isLoading}
        assistantAvatar={assistantAvatar}
        userAvatar={user?.avatar ?? null}
      />

      {/* 输入框 */}
      <ChatInput onSend={handleSend} onStop={handleStop} isLoading={isLoading} />
    </div>
  )
}
