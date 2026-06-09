import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const DEFAULT_ID = "default"

// 读取系统设置（若不存在则创建默认行），并附带套餐列表供下拉选择
export async function GET() {
  try {
    const settings = await prisma.systemSettings.upsert({
      where: { id: DEFAULT_ID },
      update: {},
      create: { id: DEFAULT_ID },
    })

    const plans = await prisma.plan.findMany({
      where: { enabled: true },
      orderBy: { price: "asc" },
      select: { id: true, name: true },
    })

    // 不把 SMTP 密码回传给前端，只告知是否已设置（前端密码框留空 = 不修改）
    const { smtpPass, ...safe } = settings
    return NextResponse.json({
      success: true,
      data: { settings: { ...safe, smtpPassSet: !!smtpPass }, plans },
    })
  } catch (error) {
    console.error("Get settings error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch settings" },
      { status: 500 }
    )
  }
}

// 更新系统设置
export async function PATCH(request: NextRequest) {
  try {
    const data = await request.json()

    const portNum = data.smtpPort ? Number(data.smtpPort) : null
    const base = {
      siteName: data.siteName,
      description: data.description ?? null,
      logoUrl: data.logoUrl || null,
      announcement: data.announcement ?? null,
      registrationMode: data.registrationMode,
      defaultPlanId: data.defaultPlanId || null,
      smtpHost: (data.smtpHost ?? "").trim() || null,
      smtpPort: Number.isFinite(portNum) ? portNum : null,
      smtpUser: (data.smtpUser ?? "").trim() || null,
      smtpFrom: (data.smtpFrom ?? "").trim() || null,
      smtpSecure: data.smtpSecure ?? true,
      requireEmailVerification: data.requireEmailVerification ?? false,
      allowedEmailDomains: (data.allowedEmailDomains ?? "").trim() || null,
    }
    // 仅当传入非空密码时才更新，留空保持原密码
    const passUpdate =
      typeof data.smtpPass === "string" && data.smtpPass.length > 0 ? { smtpPass: data.smtpPass } : {}

    const settings = await prisma.systemSettings.upsert({
      where: { id: DEFAULT_ID },
      update: { ...base, ...passUpdate },
      create: { id: DEFAULT_ID, ...base, smtpPass: data.smtpPass || null },
    })

    const { smtpPass, ...safe } = settings
    return NextResponse.json({ success: true, data: { ...safe, smtpPassSet: !!smtpPass } })
  } catch (error) {
    console.error("Update settings error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update settings" },
      { status: 500 }
    )
  }
}
