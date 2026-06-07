import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 供后台分组「成员选择器」用：返回启用模型并带 DB id（用户侧 /api/models 只给 code）。
export async function GET() {
  try {
    const models = await prisma.aiModel.findMany({
      where: { enabled: true },
      include: { provider: { select: { name: true, enabled: true } } },
      orderBy: { createdAt: "asc" },
    })

    const data = models.map((m) => ({
      id: m.id,
      code: m.code,
      name: m.name,
      provider: m.provider.name,
      providerEnabled: m.provider.enabled,
      avgLatencyMs: m.avgLatencyMs,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Get admin models error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch models" },
      { status: 500 }
    )
  }
}
