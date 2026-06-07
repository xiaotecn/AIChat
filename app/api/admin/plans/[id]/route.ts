import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()

    const plan = await prisma.plan.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        tokenLimit: data.tokenLimit,
        messageLimit: data.messageLimit,
        imageLimit: data.imageLimit,
        price: data.price,
        resetCycle: data.resetCycle,
        enabled: data.enabled,
      },
    })

    // 仅当显式传入 groupIds 数组时才全量替换套餐↔分组关联（不传则保持不变）
    if (Array.isArray(data.groupIds)) {
      const groupIds = [...new Set<string>(data.groupIds.filter((x: unknown) => typeof x === "string"))]
      await prisma.$transaction([
        prisma.planModelGroup.deleteMany({ where: { planId: id } }),
        ...(groupIds.length
          ? [
              prisma.planModelGroup.createMany({
                data: groupIds.map((groupId) => ({ planId: id, groupId })),
              }),
            ]
          : []),
      ])
    }

    return NextResponse.json({
      success: true,
      data: plan,
    })
  } catch (error) {
    console.error("Update plan error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update plan" },
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

    await prisma.plan.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: "Plan deleted successfully",
    })
  } catch (error) {
    console.error("Delete plan error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete plan" },
      { status: 500 }
    )
  }
}
