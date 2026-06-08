import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { persistImage } from "@/lib/image-store"

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

    const { conversationId, role, content, tokens, images } = await request.json()
    if (!conversationId || !role || content == null) {
      return NextResponse.json(
        { success: false, error: "参数不完整" },
        { status: 400 }
      )
    }

    if (!(await ownsConversation(conversationId, session.userId))) {
      return NextResponse.json({ success: false, error: "无权操作" }, { status: 403 })
    }

    // 用户带图提问：把每张 data URI 落盘成站内路径（/api/uploads/...），DB 只存路径数组（JSON）。
    // 复用生图的 persistImage（吃 data URI / http 链接）；单张失败则跳过，不阻断消息保存。
    let imagesJson: string | null = null
    if (Array.isArray(images) && images.length > 0) {
      const paths: string[] = []
      for (const src of images.slice(0, 4)) {
        if (typeof src !== "string" || !src) continue
        try {
          paths.push(await persistImage(src))
        } catch (e) {
          console.error("保存上传图片失败，跳过该张:", e)
        }
      }
      if (paths.length > 0) imagesJson = JSON.stringify(paths)
    }

    const message = await prisma.message.create({
      data: { conversationId, role, content, tokens: tokens ?? null, images: imagesJson },
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
