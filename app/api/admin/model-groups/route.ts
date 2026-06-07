import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 后台模型分组列表：含成员摘要（名/延迟/是否可用）、规则数、关联套餐 id。
export async function GET() {
  try {
    const groups = await prisma.modelGroup.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        members: {
          orderBy: { order: "asc" },
          include: {
            model: {
              select: {
                id: true,
                code: true,
                name: true,
                avgLatencyMs: true,
                enabled: true,
                provider: { select: { name: true, enabled: true } },
              },
            },
          },
        },
        plans: { select: { planId: true } },
        rules: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            keyword: true,
            matchType: true,
            reply: true,
            enabled: true,
            order: true,
          },
        },
        _count: { select: { rules: true } },
      },
    })

    const data = groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      avatarUrl: g.avatarUrl,
      enabled: g.enabled,
      imageGen: g.imageGen,
      cursor: g.cursor,
      members: g.members.map((m) => ({
        modelId: m.modelId,
        order: m.order,
        code: m.model.code,
        name: m.model.name,
        avgLatencyMs: m.model.avgLatencyMs,
        // 运行期是否真正可用（模型与其提供商均启用）
        usable: m.model.enabled && m.model.provider.enabled,
        provider: m.model.provider.name,
      })),
      rules: g.rules,
      ruleCount: g._count.rules,
      planIds: g.plans.map((p) => p.planId),
      createdAt: g.createdAt,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Get model groups error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch model groups" },
      { status: 500 }
    )
  }
}

// 新建分组（仅基础字段；成员/规则/套餐通过各自子路由维护）。
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    if (!data.name || typeof data.name !== "string" || !data.name.trim()) {
      return NextResponse.json(
        { success: false, error: "分组名称必填" },
        { status: 400 }
      )
    }
    const group = await prisma.modelGroup.create({
      data: {
        name: data.name.trim(),
        description: data.description ?? null,
        avatarUrl: data.avatarUrl ?? null,
        enabled: data.enabled ?? true,
        imageGen: data.imageGen ?? false,
      },
    })
    return NextResponse.json({ success: true, data: group })
  } catch (error) {
    console.error("Create model group error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create model group" },
      { status: 500 }
    )
  }
}
