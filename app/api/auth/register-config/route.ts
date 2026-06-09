import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseAllowedDomains } from "@/lib/email-rules"

// 公开：注册页据此决定是否显示验证码输入、展示允许的邮箱域名、是否允许注册。
export async function GET() {
  try {
    const s = await prisma.systemSettings.findUnique({ where: { id: "default" } })
    return NextResponse.json({
      success: true,
      data: {
        registrationMode: s?.registrationMode ?? "open",
        requireEmailVerification: !!s?.requireEmailVerification,
        allowedDomains: parseAllowedDomains(s?.allowedEmailDomains),
      },
    })
  } catch {
    return NextResponse.json({
      success: true,
      data: { registrationMode: "open", requireEmailVerification: false, allowedDomains: [] },
    })
  }
}
