import { prisma } from "@/lib/prisma"

/** 用量周期内的计数字段（periodStart 为当前周期起点）。 */
export interface UsageCounters {
  usedTokens: number
  usedMessages: number
  usedImages: number
  periodStart: Date
}

/**
 * 计算「当前周期起点 since」按 resetCycle 推进后的下一次重置时间点。
 * 支持 daily / weekly / monthly（未知取值按 monthly 处理）。
 */
export function nextResetAt(since: Date, resetCycle: string): Date {
  const next = new Date(since)
  switch (resetCycle) {
    case "daily":
      next.setDate(next.getDate() + 1)
      break
    case "weekly":
      next.setDate(next.getDate() + 7)
      break
    case "monthly":
    default:
      next.setMonth(next.getMonth() + 1)
      break
  }
  return next
}

/**
 * 惰性周期重置：当用户当前用量周期已结束（now ≥ 下一次重置时间）时，
 * 把 usedTokens / usedMessages 归零、periodStart 推进到 now 并写库。
 * 无套餐的用户没有周期定义，不重置。
 *
 * 采用「访问时重置」而非定时任务：在每次消费额度（聊天）或读取额度
 * （getCurrentUser）时调用即可，无需后台调度。返回可能已重置的最新计数。
 */
export async function maybeResetUsage<
  T extends UsageCounters & { id: string; plan: { resetCycle: string } | null }
>(user: T, now: Date = new Date()): Promise<T> {
  if (!user.plan) return user
  const due = nextResetAt(user.periodStart, user.plan.resetCycle)
  if (now < due) return user

  await prisma.user.update({
    where: { id: user.id },
    data: { usedTokens: 0, usedMessages: 0, usedImages: 0, periodStart: now },
  })
  return { ...user, usedTokens: 0, usedMessages: 0, usedImages: 0, periodStart: now }
}

/**
 * 惰性订阅过期：当用户已设到期时间且当前已过期（now ≥ expiresAt）时，把套餐回退到
 * 系统设置的 defaultPlanId、清空 expiresAt、并重置本周期额度（清零计数 + periodStart=now）。
 * 无 expiresAt（永久）或尚未到期则原样返回。
 *
 * 与 maybeResetUsage 同为「访问时惰性」机制：在 getCurrentUser / 聊天发送时调用即可，
 * 无需后台定时任务。返回（可能已回退的）最新用户对象，plan 关系已重新加载。
 * 调用顺序：先 maybeExpireSubscription（可能换套餐）再 maybeResetUsage（按新套餐判断周期）。
 */
export async function maybeExpireSubscription<
  T extends {
    id: string
    planId: string | null
    expiresAt: Date | null
    plan: { resetCycle: string } | null
  }
>(user: T, now: Date = new Date()): Promise<T> {
  if (!user.expiresAt || now < user.expiresAt) return user

  const settings = await prisma.systemSettings.findFirst()
  const defaultPlanId = settings?.defaultPlanId ?? null

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      planId: defaultPlanId,
      expiresAt: null,
      // 有默认套餐则视为已激活默认订阅，否则标记为已过期（无套餐）
      subscriptionStatus: defaultPlanId ? "active" : "expired",
      usedTokens: 0,
      usedMessages: 0,
      usedImages: 0,
      periodStart: now,
    },
    include: { plan: true },
  })
  return { ...user, ...updated } as unknown as T
}

/**
 * 批量清扫所有已过期订阅，回退到 defaultPlanId 并重置额度。供后台用户列表加载时调用，
 * 使管理员打开页面即看到回退后的真实状态（不必等用户本人下次访问触发惰性回退）。
 * 已在默认套餐上的用户不动。返回被回退的用户数。
 */
export async function sweepExpiredSubscriptions(now: Date = new Date()): Promise<number> {
  const settings = await prisma.systemSettings.findFirst()
  const defaultPlanId = settings?.defaultPlanId ?? null
  const res = await prisma.user.updateMany({
    where: { expiresAt: { lt: now }, NOT: { planId: defaultPlanId } },
    data: {
      planId: defaultPlanId,
      expiresAt: null,
      subscriptionStatus: defaultPlanId ? "active" : "expired",
      usedTokens: 0,
      usedMessages: 0,
      usedImages: 0,
      periodStart: now,
    },
  })
  return res.count
}
