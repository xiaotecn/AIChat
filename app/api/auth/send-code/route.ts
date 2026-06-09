import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rateLimit, clientIp } from "@/lib/rate-limit"
import { getMailConfig, sendVerificationCode } from "@/lib/mailer"
import { parseAllowedDomains, isEmailDomainAllowed } from "@/lib/email-rules"

// 注册前发送邮箱验证码：校验注册开放/域名白名单/邮箱未占用 → 生成 6 位码落库 → SMTP 发送。
export async function POST(request: NextRequest) {
  try {
    // 限流：同一 IP 每小时最多 10 次发码
    const rl = rateLimit(`send-code:${clientIp(request)}`, 10, 60 * 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "操作过于频繁，请稍后再试" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      )
    }

    const body = await request.json()
    const email = String(body.email || "").trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: "邮箱格式不正确" }, { status: 400 })
    }

    const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } })
    const mode = settings?.registrationMode ?? "open"
    if (mode !== "open") {
      return NextResponse.json(
        { success: false, error: mode === "closed" ? "当前已关闭注册" : "当前为邀请注册，请联系管理员开通账号" },
        { status: 403 }
      )
    }

    const allowed = parseAllowedDomains(settings?.allowedEmailDomains)
    if (!isEmailDomainAllowed(email, allowed)) {
      return NextResponse.json(
        { success: false, error: `仅支持以下邮箱注册：${allowed.join("、")}` },
        { status: 403 }
      )
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ success: false, error: "该邮箱已被注册" }, { status: 409 })
    }

    const cfg = await getMailConfig()
    if (!cfg) {
      return NextResponse.json({ success: false, error: "邮件服务未配置，请联系管理员" }, { status: 500 })
    }

    // 60s 内不重复发送（防刷邮件）
    const last = await prisma.emailCode.findFirst({ where: { email }, orderBy: { createdAt: "desc" } })
    if (last && Date.now() - new Date(last.createdAt).getTime() < 60_000) {
      return NextResponse.json({ success: false, error: "验证码已发送，请 60 秒后再试" }, { status: 429 })
    }

    const code = String(Math.floor(100000 + Math.random() * 900000))
    await prisma.emailCode.create({
      data: { email, code, expiresAt: new Date(Date.now() + 10 * 60_000) },
    })

    const siteName = settings?.siteName?.trim() || "AI Chat"
    try {
      await sendVerificationCode(cfg, email, code, siteName)
    } catch (e) {
      console.error("发送验证码邮件失败:", e)
      return NextResponse.json(
        { success: false, error: "验证码发送失败，请确认邮箱地址或稍后重试" },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("send-code error:", e)
    return NextResponse.json({ success: false, error: "发送失败，请稍后重试" }, { status: 500 })
  }
}
