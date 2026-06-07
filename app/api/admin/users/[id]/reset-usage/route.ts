import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 重置某用户当前订阅周期的额度：清零已用 token / 消息，并把周期起点设为当前时间。
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await prisma.user.update({
      where: { id },
      data: {
        usedTokens: 0,
        usedMessages: 0,
        usedImages: 0,
        periodStart: new Date(),
      },
    })
    return NextResponse.json({ success: true, data: { id: user.id } })
  } catch (error) {
    console.error("Reset usage error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to reset usage" },
      { status: 500 }
    )
  }
}
