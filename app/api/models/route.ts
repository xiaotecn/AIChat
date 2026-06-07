import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 面向聊天页的可用模型列表：仅返回「已启用提供商」下「已启用」的模型
export async function GET() {
  try {
    const models = await prisma.aiModel.findMany({
      where: {
        enabled: true,
        provider: { enabled: true },
      },
      include: { provider: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    })

    const data = models.map((m) => ({
      code: m.code,
      name: m.name,
      provider: m.provider.name,
      contextLength: m.contextLength,
      price: m.price,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Get models error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch models" },
      { status: 500 }
    )
  }
}
