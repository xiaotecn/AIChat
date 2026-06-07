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

    return NextResponse.json({ success: true, data: { settings, plans } })
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

    const settings = await prisma.systemSettings.upsert({
      where: { id: DEFAULT_ID },
      update: {
        siteName: data.siteName,
        description: data.description ?? null,
        announcement: data.announcement ?? null,
        registrationMode: data.registrationMode,
        defaultPlanId: data.defaultPlanId || null,
      },
      create: {
        id: DEFAULT_ID,
        siteName: data.siteName ?? "AI Chat",
        description: data.description ?? null,
        announcement: data.announcement ?? null,
        registrationMode: data.registrationMode ?? "open",
        defaultPlanId: data.defaultPlanId || null,
      },
    })

    return NextResponse.json({ success: true, data: settings })
  } catch (error) {
    console.error("Update settings error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update settings" },
      { status: 500 }
    )
  }
}
