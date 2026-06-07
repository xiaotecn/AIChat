import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { getGroupsForUser } from "@/lib/groups"

// 面向聊天页的「可选分组」列表：由用户订阅套餐决定可见哪些分组。
// 统一返回形状 data:[{id,name,description,memberCount}]，前端以 id 作为 body.model 提交。
// 回退：用户无套餐 / 套餐未关联任何启用分组时，返回旧的启用模型列表（以 code 充当 id）
// 伪装成分组（mode:"model"），保证选择器永不为空、与旧版平滑过渡。
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 })
    }

    const groups = await getGroupsForUser(user.planId)
    if (groups.length > 0) {
      return NextResponse.json({
        success: true,
        mode: "group",
        data: groups.map((g) => ({
          id: g.id,
          name: g.name,
          description: g.description,
          memberCount: g.memberCount,
          avatarUrl: g.avatarUrl,
        })),
      })
    }

    // 回退：旧启用模型列表，code 充当 id，名称带上提供商便于区分
    const models = await prisma.aiModel.findMany({
      where: { enabled: true, provider: { enabled: true } },
      include: { provider: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    })
    return NextResponse.json({
      success: true,
      mode: "model",
      data: models.map((m) => ({
        id: m.code,
        name: `${m.name}（${m.provider.name}）`,
        description: null,
        memberCount: 0,
        avatarUrl: null,
      })),
    })
  } catch (error) {
    console.error("Get model groups error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch model groups" },
      { status: 500 }
    )
  }
}
