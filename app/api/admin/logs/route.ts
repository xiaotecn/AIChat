import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET - 获取调用日志（来自真实的 ApiLog 表）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const model = searchParams.get("model")

    const where: { status?: string; model?: string } = {}
    if (status) where.status = status
    if (model) where.model = model

    const logs = await prisma.apiLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    })

    const data = logs.map((log) => ({
      id: log.id,
      user: log.user,
      action: log.action,
      channel: log.providerName || log.providerId, // 渠道名（旧数据无 providerName 时回退到 id）
      model: log.model,
      tokens: log.tokens,
      status: log.status,
      message: log.message,
      time: log.createdAt.toISOString(), // 返回 ISO，由前端按浏览器本地时区展示
    }))

    return NextResponse.json({
      success: true,
      data,
      total: data.length,
    })
  } catch (error) {
    console.error("Get logs error:", error)
    return NextResponse.json(
      { success: false, error: "获取日志失败" },
      { status: 500 }
    )
  }
}
