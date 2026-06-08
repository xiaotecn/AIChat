import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { getGroupsForUser } from "@/lib/groups"

// 面向聊天页的「可选分组」列表：由用户订阅套餐决定可见哪些分组。
// 统一返回形状 data:[{id,name,description,memberCount,avatarUrl}]，前端以 id 作为 body.model 提交。
// 仅返回「套餐授权 且 含可用模型」的分组；无则返回空（前端显示「暂无可用模型」），不回退到全部模型。
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 })
    }

    // 只返回有可用模型的授权分组；没有就空（不再回退到全部渠道模型）
    const groups = (await getGroupsForUser(user.planId)).filter((g) => g.memberCount > 0)
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
  } catch (error) {
    console.error("Get model groups error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch model groups" },
      { status: 500 }
    )
  }
}
