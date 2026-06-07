import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { maybeResetUsage, maybeExpireSubscription } from "@/lib/quota"
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  encryptSession,
  decryptSession,
  type SessionPayload,
} from "@/lib/session"

/** 在路由处理器中读取并校验当前会话。 */
export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return decryptSession(token)
}

/** 设置会话 Cookie（登录/注册成功后调用）。 */
export async function setSessionCookie(user: {
  id: string
  role: string
  email: string
}) {
  const token = await encryptSession({
    userId: user.id,
    role: user.role,
    email: user.email,
  })
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  })
}

/** 清除会话 Cookie（登出）。 */
export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

/** 返回当前登录用户的安全字段（含套餐与限额），未登录返回 null。 */
export async function getCurrentUser() {
  const session = await getSession()
  if (!session) return null

  const raw = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { plan: true },
  })
  if (!raw) return null

  // 先做惰性订阅过期回退（可能换套餐并重置额度），再做惰性周期重置（按当前套餐）
  const afterExpiry = await maybeExpireSubscription(raw)
  const user = await maybeResetUsage(afterExpiry)

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    status: user.status,
    planId: user.planId,
    expiresAt: user.expiresAt,
    subscriptionStatus: user.subscriptionStatus,
    usedTokens: user.usedTokens,
    usedMessages: user.usedMessages,
    usedImages: user.usedImages,
    tokenLimit: user.plan?.tokenLimit ?? 0,
    messageLimit: user.plan?.messageLimit ?? 0,
    imageLimit: user.plan?.imageLimit ?? 0,
    planName: user.plan?.name ?? null,
  }
}
