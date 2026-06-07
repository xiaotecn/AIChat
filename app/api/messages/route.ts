import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

// 确认对话归属当前登录用户
async function ownsConversation(conversationId: string, userId: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { userId: true },
  })
  return conv?.userId === userId
}

// 保存消息（仅能写入本人的对话）
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 })
    }

    const { conversationId, role, content, tokens } = await request.json()
    if (!conversationId || !role || content == null) {
      return NextResponse.json(
        { success: false, error: "参数不完整" },
        { status: 400 }
      )
    }

    if (!(await ownsConversation(conversationId, session.userId))) {
      return NextResponse.json({ success: false, error: "无权操作" }, { status: 403 })
    }

    const message = await prisma.message.create({
      data: { conversationId, role, content, tokens: tokens ?? null },
    })

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({ success: true, data: message })
  } catch (error) {
    console.error("Create message error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create message" },
      { status: 500 }
    )
  }
}

// 获取某对话的消息（仅限本人的对话）
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get("conversationId")
    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: "conversationId is required" },
        { status: 400 }
      )
    }

    if (!(await ownsConversation(conversationId, session.userId))) {
      return NextResponse.json({ success: false, error: "无权访问" }, { status: 403 })
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({ success: true, data: messages })
  } catch (error) {
    console.error("Get messages error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch messages" },
      { status: 500 }
    )
  }
}
