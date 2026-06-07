import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: {
        price: 'asc',
      },
      include: { groups: { select: { groupId: true } } },
    })

    // 获取每个套餐的用户数
    const plansWithUsers = await Promise.all(
      plans.map(async (plan) => {
        const userCount = await prisma.user.count({
          where: {
            planId: plan.id,
          },
        })

        const { groups, ...rest } = plan
        return {
          ...rest,
          users: userCount,
          groupIds: groups.map((g) => g.groupId),
          features: [], // 可以从数据库或配置中读取
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: plansWithUsers,
    })
  } catch (error) {
    console.error("Get plans error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch plans" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    const plan = await prisma.plan.create({
      data: {
        name: data.name,
        description: data.description,
        tokenLimit: data.tokenLimit,
        messageLimit: data.messageLimit,
        imageLimit: data.imageLimit ?? -1,
        price: data.price,
        resetCycle: data.resetCycle || 'monthly',
        enabled: data.enabled ?? true,
      },
    })

    // 可选：建套餐时一并关联模型分组
    if (Array.isArray(data.groupIds) && data.groupIds.length > 0) {
      const groupIds = [...new Set<string>(data.groupIds.filter((x: unknown) => typeof x === "string"))]
      if (groupIds.length > 0) {
        await prisma.planModelGroup.createMany({
          data: groupIds.map((groupId) => ({ planId: plan.id, groupId })),
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: plan,
    })
  } catch (error) {
    console.error("Create plan error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create plan" },
      { status: 500 }
    )
  }
}
