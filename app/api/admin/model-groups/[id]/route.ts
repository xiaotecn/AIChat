import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 改分组基础字段（name/description/avatarUrl/enabled/imageGen）。未传的字段保持不变。
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()
    const group = await prisma.modelGroup.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        avatarUrl: data.avatarUrl,
        enabled: data.enabled,
        imageGen: data.imageGen,
      },
    })
    return NextResponse.json({ success: true, data: group })
  } catch (error) {
    console.error("Update model group error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update model group" },
      { status: 500 }
    )
  }
}

// 删除分组：成员/规则/套餐关联均按 schema 的 onDelete: Cascade 一并清除。
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.modelGroup.delete({ where: { id } })
    return NextResponse.json({ success: true, message: "deleted" })
  } catch (error) {
    console.error("Delete model group error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete model group" },
      { status: 500 }
    )
  }
}
