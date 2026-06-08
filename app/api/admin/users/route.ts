import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sweepExpiredSubscriptions } from "@/lib/quota"

export async function GET() {
  try {
    // 列表加载前先批量回收已过期订阅，使展示反映回退后的真实状态
    await sweepExpiredSubscriptions()

    const users = await prisma.user.findMany({
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // 获取每个用户的 token 和消息限额
    const usersWithLimits = users.map(user => ({
      ...user,
      tokenLimit: user.plan?.tokenLimit || 0,
      messageLimit: user.plan?.messageLimit || 0,
      imageLimit: user.plan?.imageLimit ?? 0,
    }))

    return NextResponse.json({
      success: true,
      data: usersWithLimits,
    })
  } catch (error) {
    console.error("Get users error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const bcrypt = require('bcryptjs')

    // 创建弹窗不再选套餐（订阅交由专门入口管理）：未显式指定时回退到系统默认套餐，保证新用户开箱即用
    let planId: string | null = data.planId || null
    if (!planId) {
      const settings = await prisma.systemSettings.findFirst()
      planId = settings?.defaultPlanId ?? null
    }

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: await bcrypt.hash(data.password, 10),
        role: data.role || 'user',
        planId,
        status: data.status || 'active',
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        subscriptionStatus: data.expiresAt ? 'active' : (data.subscriptionStatus || 'active'),
      },
    })

    return NextResponse.json({
      success: true,
      data: user,
    })
  } catch (error) {
    console.error("Create user error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create user" },
      { status: 500 }
    )
  }
}
