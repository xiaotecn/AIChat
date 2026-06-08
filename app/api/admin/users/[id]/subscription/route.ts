import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 管理员订阅操作：开通/变更(activate)、加时间(extend)、取消(cancel)。
// 与「编辑用户」分离的专门入口。取消订阅的回退语义与惰性过期(quota.ts → maybeExpireSubscription)保持一致：
// 回退到系统默认套餐、清空到期时间、重置当前用量周期。
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const action = body.action as string
    const now = new Date()

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json({ success: false, error: "用户不存在" }, { status: 404 })
    }

    if (action === "activate") {
      // 开通 / 变更订阅：指定套餐 + 到期时间(空 = 永久不过期)，并重置为全新的用量周期
      if (!body.planId) {
        return NextResponse.json({ success: false, error: "请选择套餐" }, { status: 400 })
      }
      const updated = await prisma.user.update({
        where: { id },
        data: {
          planId: body.planId,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
          subscriptionStatus: "active",
          usedTokens: 0,
          usedMessages: 0,
          usedImages: 0,
          periodStart: now,
        },
      })
      return NextResponse.json({ success: true, data: subInfo(updated) })
    }

    if (action === "extend") {
      // 加时间：在现有到期时间(若已过期/永久则从现在算)基础上叠加 days 天；不动用量
      const days = Number(body.days)
      if (!Number.isFinite(days) || days <= 0) {
        return NextResponse.json({ success: false, error: "天数无效" }, { status: 400 })
      }
      const base = user.expiresAt && user.expiresAt > now ? new Date(user.expiresAt) : new Date(now)
      base.setDate(base.getDate() + days)
      const updated = await prisma.user.update({
        where: { id },
        data: { expiresAt: base, subscriptionStatus: "active" },
      })
      return NextResponse.json({ success: true, data: subInfo(updated) })
    }

    if (action === "cancel") {
      // 取消订阅：回退到系统默认套餐、清空到期时间并重置用量(与过期回退一致)
      const settings = await prisma.systemSettings.findFirst()
      const defaultPlanId = settings?.defaultPlanId ?? null
      const updated = await prisma.user.update({
        where: { id },
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
      return NextResponse.json({ success: true, data: subInfo(updated) })
    }

    return NextResponse.json({ success: false, error: "未知操作" }, { status: 400 })
  } catch (error) {
    console.error("Subscription action error:", error)
    return NextResponse.json(
      { success: false, error: "订阅操作失败" },
      { status: 500 }
    )
  }
}

// 操作后回传订阅相关字段，供前端即时刷新弹窗与列表
function subInfo(u: {
  id: string
  planId: string | null
  expiresAt: Date | null
  subscriptionStatus: string
}) {
  return {
    id: u.id,
    planId: u.planId,
    expiresAt: u.expiresAt,
    subscriptionStatus: u.subscriptionStatus,
  }
}
