import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function formatTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

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
      model: log.model,
      tokens: log.tokens,
      status: log.status,
      message: log.message,
      time: formatTime(log.createdAt),
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
