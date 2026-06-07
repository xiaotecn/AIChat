import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 删除一个模型
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.aiModel.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete model error:", error)
    return NextResponse.json(
      { success: false, error: "删除模型失败" },
      { status: 500 }
    )
  }
}

// 启用/禁用一个模型
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()
    const model = await prisma.aiModel.update({
      where: { id },
      data: {
        enabled: data.enabled,
        name: data.name,
        price: data.price,
      },
    })
    return NextResponse.json({ success: true, data: model })
  } catch (error) {
    console.error("Update model error:", error)
    return NextResponse.json(
      { success: false, error: "更新模型失败" },
      { status: 500 }
    )
  }
}
