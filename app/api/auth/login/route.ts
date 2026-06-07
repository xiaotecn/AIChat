import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { setSessionCookie } from "@/lib/auth"
import { rateLimit, clientIp } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    // 限流：同一 IP 5 分钟内最多 10 次登录尝试，挡撞库 / 暴力破解
    const rl = rateLimit(`login:${clientIp(request)}`, 10, 5 * 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "尝试过于频繁，请稍后再试" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      )
    }

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "请输入邮箱和密码" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).trim().toLowerCase() },
    })

    // 统一的错误信息，避免泄露账号是否存在
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json(
        { success: false, error: "邮箱或密码错误" },
        { status: 401 }
      )
    }

    if (user.status !== "active") {
      return NextResponse.json(
        { success: false, error: "账号已被禁用，请联系管理员" },
        { status: 403 }
      )
    }

    await setSessionCookie(user)

    return NextResponse.json({
      success: true,
      data: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { success: false, error: "登录失败，请稍后重试" },
      { status: 500 }
    )
  }
}
