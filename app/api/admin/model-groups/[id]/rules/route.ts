import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

interface RuleInput {
  keyword?: unknown
  matchType?: unknown
  reply?: unknown
  enabled?: unknown
  order?: unknown
}

// 全量替换分组的关键词规则。空 keyword / 空 reply 的行被丢弃。
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()
    const raw: RuleInput[] = Array.isArray(data.rules) ? data.rules : []

    const rules = raw
      .map((r, i) => ({
        groupId: id,
        keyword: String(r.keyword ?? "").trim(),
        matchType: r.matchType === "exact" ? "exact" : "contains",
        reply: String(r.reply ?? "").trim(),
        enabled: r.enabled === undefined ? true : Boolean(r.enabled),
        order: typeof r.order === "number" ? r.order : i,
      }))
      .filter((r) => r.keyword.length > 0 && r.reply.length > 0)

    await prisma.$transaction([
      prisma.keywordRule.deleteMany({ where: { groupId: id } }),
      ...(rules.length ? [prisma.keywordRule.createMany({ data: rules })] : []),
    ])

    return NextResponse.json({ success: true, count: rules.length })
  } catch (error) {
    console.error("Replace keyword rules error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update keyword rules" },
      { status: 500 }
    )
  }
}
