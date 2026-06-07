import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

// 查询单条消息的内容/状态（仅本人对话）。供前端轮询生图 pending 任务的结果。
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 })
    }
    const { id } = await params
    const msg = await prisma.message.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        content: true,
        status: true,
        conversation: { select: { userId: true } },
      },
    })
    if (!msg) {
      return NextResponse.json({ success: false, error: "消息不存在" }, { status: 404 })
    }
    if (msg.conversation.userId !== session.userId) {
      return NextResponse.json({ success: false, error: "无权访问" }, { status: 403 })
    }
    return NextResponse.json({
      success: true,
      data: { id: msg.id, role: msg.role, content: msg.content, status: msg.status },
    })
  } catch (error) {
    console.error("Get message error:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch message" }, { status: 500 })
  }
}

// 删除一条消息（仅能删除本人对话下的消息）。用于「重新生成」时清理旧回复。
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 })
    }

    const { id } = await params
    const msg = await prisma.message.findUnique({
      where: { id },
      select: { conversation: { select: { userId: true } } },
    })
    if (!msg) {
      return NextResponse.json({ success: false, error: "消息不存在" }, { status: 404 })
    }
    if (msg.conversation.userId !== session.userId) {
      return NextResponse.json({ success: false, error: "无权操作" }, { status: 403 })
    }

    await prisma.message.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete message error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete message" },
      { status: 500 }
    )
  }
}
