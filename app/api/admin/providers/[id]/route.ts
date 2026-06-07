import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { encryptSecret } from "@/lib/crypto"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()

    const updateData: {
      name?: string
      baseUrl?: string
      apiKey?: string
      enabled?: boolean
    } = {
      name: data.name,
      baseUrl: data.baseUrl,
      enabled: data.enabled,
    }
    // 仅当传入「新的明文 key」时才更新（留空 = 保持原 key；打码占位串含「•」直接忽略）
    if (typeof data.apiKey === "string" && data.apiKey.trim() && !data.apiKey.includes("•")) {
      updateData.apiKey = encryptSecret(data.apiKey.trim())
    }

    const provider = await prisma.aiProvider.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: provider,
    })
  } catch (error) {
    console.error("Update provider error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update provider" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.aiProvider.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: "Provider deleted successfully",
    })
  } catch (error) {
    console.error("Delete provider error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete provider" },
      { status: 500 }
    )
  }
}
