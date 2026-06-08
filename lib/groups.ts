import { prisma } from "@/lib/prisma"

/** 关键词规则命中结果。 */
export interface KeywordHit {
  reply: string
}

/**
 * 分组级关键词匹配：按 order 升序取该分组 enabled 的规则，返回首个命中的预设回复。
 *   - contains：小写子串包含
 *   - exact：去首尾空白后小写全等
 * 均未命中返回 null（调用方继续走大模型）。
 */
export async function matchKeywordRule(
  groupId: string,
  message: string
): Promise<KeywordHit | null> {
  const rules = await prisma.keywordRule.findMany({
    where: { groupId, enabled: true },
    orderBy: { order: "asc" },
  })
  const msg = message.toLowerCase()
  const msgTrimmed = msg.trim()
  for (const rule of rules) {
    const kw = rule.keyword.toLowerCase()
    const hit =
      rule.matchType === "exact"
        ? msgTrimmed === kw.trim()
        : msg.includes(kw)
    if (hit) return { reply: rule.reply }
  }
  return null
}

/** 分组内一个「可用」模型成员（模型 enabled 且其 provider enabled）。 */
export interface GroupModel {
  modelId: string
  code: string
}

/**
 * 解析分组内可用的模型成员，按 member.order 升序。
 * 仅返回模型本身 enabled 且其所属 provider 也 enabled 的成员，供轮询/故障转移使用。
 */
export async function resolveGroupModels(
  groupId: string
): Promise<GroupModel[]> {
  const members = await prisma.modelGroupMember.findMany({
    where: {
      groupId,
      model: { enabled: true, provider: { enabled: true } },
    },
    include: { model: { select: { code: true } } },
    orderBy: { order: "asc" },
  })
  return members.map((m) => ({ modelId: m.modelId, code: m.model.code }))
}

/** 用户可选的分组摘要（用于聊天页选择器）。 */
export interface UserGroup {
  id: string
  name: string
  description: string | null
  memberCount: number
  avatarUrl: string | null
}

/**
 * 取某套餐授权的 enabled 分组列表（含成员数）。
 * planId 为空（未订阅套餐）时返回空数组，调用方负责回退到旧的模型列表。
 */
export async function getGroupsForUser(
  planId: string | null | undefined
): Promise<UserGroup[]> {
  if (!planId) return []
  const links = await prisma.planModelGroup.findMany({
    where: { planId, group: { enabled: true } },
    include: {
      group: {
        include: {
          // 只数「可用」成员（模型与其提供商均启用）；据此 memberCount=0 的分组前端不展示
          members: {
            where: { model: { enabled: true, provider: { enabled: true } } },
            select: { modelId: true },
          },
        },
      },
    },
  })
  return links.map((l) => ({
    id: l.group.id,
    name: l.group.name,
    description: l.group.description,
    memberCount: l.group.members.length,
    avatarUrl: l.group.avatarUrl,
  }))
}

/**
 * 记录某模型一次调用延迟，用 EMA 平滑（新值权重 0.3）写回 AiModel.avgLatencyMs。
 * fire-and-forget：不 await、吞掉异常，绝不阻塞流式响应。首个样本直接采用本次值。
 */
export function recordLatency(modelId: string | null, ms: number): void {
  if (!modelId) return
  prisma.aiModel
    .findUnique({ where: { id: modelId }, select: { avgLatencyMs: true } })
    .then((m) => {
      const old = m?.avgLatencyMs ?? 0
      const next = old ? old * 0.7 + ms * 0.3 : ms
      return prisma.aiModel.update({
        where: { id: modelId },
        data: { avgLatencyMs: next },
      })
    })
    .catch(() => {})
}
