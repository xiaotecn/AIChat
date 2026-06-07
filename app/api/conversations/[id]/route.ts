import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

// 重命名对话（仅限本人）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 })
    }
    const { id } = await params
    const data = await request.json()

    // 校验归属
    const existing = await prisma.conversation.findUnique({ where: { id } })
    if (!existing || existing.userId !== session.userId) {
      return NextResponse.json({ success: false, error: "对话不存在" }, { status: 404 })
    }

    const conversation = await prisma.conversation.update({
      where: { id },
      data: {
        title: data.title?.slice(0, 100) ?? existing.title,
        modelId: data.modelId ?? existing.modelId,
      },
    })

    return NextResponse.json({ success: true, data: conversation })
  } catch (error) {
    console.error("Update conversation error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update conversation" },
      { status: 500 }
    )
  }
}

// 删除对话（仅限本人，级联删除消息）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 })
    }
    const { id } = await params

    const existing = await prisma.conversation.findUnique({ where: { id } })
    if (!existing || existing.userId !== session.userId) {
      return NextResponse.json({ success: false, error: "对话不存在" }, { status: 404 })
    }

    await prisma.conversation.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete conversation error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete conversation" },
      { status: 500 }
    )
  }
}
