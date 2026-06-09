import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getMailConfig, sendMail } from "@/lib/mailer"

// 后台「发送测试邮件」：用已保存的 SMTP 配置给当前管理员邮箱发一封测试邮件。
// 路由在 /api/admin 下，已由 proxy 限定管理员；这里再取一次会话拿收件邮箱。
export async function POST() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 })
    }
    const cfg = await getMailConfig()
    if (!cfg) {
      return NextResponse.json(
        { success: false, error: "请先填写并保存 SMTP 配置（主机/端口/账号/密码）" },
        { status: 400 }
      )
    }
    try {
      await sendMail(
        cfg,
        session.email,
        "SMTP 测试邮件",
        "<p>这是一封来自后台的 SMTP 测试邮件。若你收到了它，说明邮件配置已生效。</p>"
      )
    } catch (e) {
      return NextResponse.json(
        { success: false, error: "发送失败：" + (e as Error).message },
        { status: 502 }
      )
    }
    return NextResponse.json({ success: true, data: { to: session.email } })
  } catch (e) {
    console.error("test-smtp error:", e)
    return NextResponse.json({ success: false, error: "测试失败" }, { status: 500 })
  }
}
