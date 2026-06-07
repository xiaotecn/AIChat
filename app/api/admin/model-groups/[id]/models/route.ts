import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 全量替换分组成员：modelIds 的顺序即轮询顺序（order=下标）。重置轮询游标 cursor=0。
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()
    // 去重并保序（保留首次出现位置），避免复合主键 [groupId, modelId] 冲突
    const seen = new Set<string>()
    const modelIds: string[] = (Array.isArray(data.modelIds) ? data.modelIds : [])
      .filter((x: unknown): x is string => typeof x === "string" && x.length > 0)
      .filter((x: string) => (seen.has(x) ? false : (seen.add(x), true)))

    await prisma.$transaction([
      prisma.modelGroupMember.deleteMany({ where: { groupId: id } }),
      ...(modelIds.length
        ? [
            prisma.modelGroupMember.createMany({
              data: modelIds.map((modelId, order) => ({ groupId: id, modelId, order })),
            }),
          ]
        : []),
      prisma.modelGroup.update({ where: { id }, data: { cursor: 0 } }),
    ])

    return NextResponse.json({ success: true, count: modelIds.length })
  } catch (error) {
    console.error("Replace group members error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update group members" },
      { status: 500 }
    )
  }
}
