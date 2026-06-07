import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

// 创建对话（归属当前登录用户）
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 })
    }

    const { title, modelId } = await request.json()

    const conversation = await prisma.conversation.create({
      data: {
        title: (title || "新对话").slice(0, 100),
        userId: session.userId,
        modelId: modelId || "gpt-3.5-turbo",
      },
    })

    return NextResponse.json({ success: true, data: conversation })
  } catch (error) {
    console.error("Create conversation error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create conversation" },
      { status: 500 }
    )
  }
}

// 获取当前登录用户的对话列表（含最后一条消息用于预览）
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 })
    }

    const conversations = await prisma.conversation.findMany({
      where: { userId: session.userId },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
    })

    return NextResponse.json({ success: true, data: conversations })
  } catch (error) {
    console.error("Get conversations error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch conversations" },
      { status: 500 }
    )
  }
}
