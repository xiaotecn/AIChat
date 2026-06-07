import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getCurrentUser, getSession } from "@/lib/auth"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, error: "未登录" },
      { status: 401 }
    )
  }
  return NextResponse.json({ success: true, data: user })
}

// 账号名称：中文 / 英文 / 数字 / 下划线 / 短横线，1–15 位（与编辑页前端校验一致）
const NAME_PATTERN = /^[一-龥A-Za-z0-9_-]{1,15}$/

// 当前登录用户「自助」更新本人资料：名称 / 头像 / 密码。
// 身份一律以会话为准（getSession），绝不信任前端传入的用户 id。
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const data: { name?: string; avatar?: string | null; passwordHash?: string } = {}

    // 名称
    if (typeof body.name === "string") {
      const name = body.name.trim()
      if (!NAME_PATTERN.test(name)) {
        return NextResponse.json(
          { success: false, error: "账号名称只支持中文、英文、数字、下划线和短横线，且不超过 15 字" },
          { status: 400 }
        )
      }
      data.name = name
    }

    // 头像：key 存在才更新（string=设置 data URI / null=清除回退首字母），保持「未传=不改」
    if ("avatar" in body) {
      if (body.avatar === null || typeof body.avatar === "string") {
        data.avatar = body.avatar
      }
    }

    // 改密码：传了 newPassword 才走，需校验当前密码
    if (body.newPassword) {
      const newPassword = String(body.newPassword)
      const currentPassword = String(body.currentPassword || "")
      if (newPassword.length < 6) {
        return NextResponse.json({ success: false, error: "新密码至少 6 位" }, { status: 400 })
      }
      const me = await prisma.user.findUnique({ where: { id: session.userId } })
      if (!me) {
        return NextResponse.json({ success: false, error: "用户不存在" }, { status: 404 })
      }
      const ok = await bcrypt.compare(currentPassword, me.passwordHash)
      if (!ok) {
        return NextResponse.json({ success: false, error: "当前密码不正确" }, { status: 400 })
      }
      data.passwordHash = await bcrypt.hash(newPassword, 10)
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: "没有可更新的内容" }, { status: 400 })
    }

    await prisma.user.update({ where: { id: session.userId }, data })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update profile error:", error)
    return NextResponse.json({ success: false, error: "保存失败，请稍后重试" }, { status: 500 })
  }
}
