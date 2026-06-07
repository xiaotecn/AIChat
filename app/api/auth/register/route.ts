import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { setSessionCookie } from "@/lib/auth"
import { rateLimit, clientIp } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    // 限流：同一 IP 每小时最多注册 5 个账号，挡批量刷号
    const rl = rateLimit(`register:${clientIp(request)}`, 5, 60 * 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "操作过于频繁，请稍后再试" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      )
    }

    const body = await request.json()
    const name = String(body.name || "").trim()
    const email = String(body.email || "").trim().toLowerCase()
    const password = String(body.password || "")

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: "请填写姓名、邮箱和密码" },
        { status: 400 }
      )
    }
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "密码至少 6 位" },
        { status: 400 }
      )
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: "邮箱格式不正确" },
        { status: 400 }
      )
    }

    // 按系统设置控制注册开放状态
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "default" },
    })
    const mode = settings?.registrationMode ?? "open"
    if (mode === "closed") {
      return NextResponse.json(
        { success: false, error: "当前已关闭注册" },
        { status: 403 }
      )
    }
    if (mode === "invite") {
      return NextResponse.json(
        { success: false, error: "当前为邀请注册，请联系管理员开通账号" },
        { status: 403 }
      )
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { success: false, error: "该邮箱已被注册" },
        { status: 409 }
      )
    }

    // 分配默认套餐（系统设置中的默认套餐，否则尝试 free）
    let planId: string | null = settings?.defaultPlanId ?? null
    if (!planId) {
      const freePlan = await prisma.plan.findFirst({ where: { id: "free" } })
      planId = freePlan?.id ?? null
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role: "user",
        status: "active",
        planId,
      },
    })

    await setSessionCookie(user)

    return NextResponse.json({
      success: true,
      data: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (error) {
    console.error("Register error:", error)
    return NextResponse.json(
      { success: false, error: "注册失败，请稍后重试" },
      { status: 500 }
    )
  }
}
