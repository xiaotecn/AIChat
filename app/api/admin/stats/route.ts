import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 周环比增长率（本周 vs 上周），均为真实数据计算
function wowGrowth(thisWeek: number, lastWeek: number): number {
  if (lastWeek <= 0) return thisWeek > 0 ? 100 : 0
  return Math.round(((thisWeek - lastWeek) / lastWeek) * 1000) / 10
}

export async function GET() {
  try {
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const startOfToday = new Date(new Date().setHours(0, 0, 0, 0))
    const weekAgo = new Date(now - 7 * dayMs)
    const twoWeeksAgo = new Date(now - 14 * dayMs)

    // 调用日志是当前唯一真实的「活动」数据源（聊天会话存于浏览器本地）
    const [
      totalUsers,
      activeUsers,
      usersThisWeek,
      usersLastWeek,
      apiTotal,
      apiToday,
      apiThisWeek,
      apiLastWeek,
      tokensAll,
      tokensToday,
      tokensThisWeek,
      tokensLastWeek,
      recentUsers,
      recentWeekUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "active" } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.user.count({
        where: { createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
      }),
      prisma.apiLog.count(),
      prisma.apiLog.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.apiLog.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.apiLog.count({
        where: { createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
      }),
      prisma.apiLog.aggregate({ _sum: { tokens: true } }),
      prisma.apiLog.aggregate({
        _sum: { tokens: true },
        where: { createdAt: { gte: startOfToday } },
      }),
      prisma.apiLog.aggregate({
        _sum: { tokens: true },
        where: { createdAt: { gte: weekAgo } },
      }),
      prisma.apiLog.aggregate({
        _sum: { tokens: true },
        where: { createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
      }),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, createdAt: true },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: weekAgo } },
        select: { createdAt: true },
      }),
    ])

    // 最近 7 天每日新增用户（真实分桶）
    const buckets = new Array(7).fill(0)
    for (const u of recentWeekUsers) {
      const idx = Math.floor((u.createdAt.getTime() - weekAgo.getTime()) / dayMs)
      if (idx >= 0 && idx < 7) buckets[idx]++
    }
    const userGrowth = buckets.map((count, i) => {
      const d = new Date(weekAgo.getTime() + i * dayMs)
      return { date: `${d.getMonth() + 1}/${d.getDate()}`, count }
    })

    const tokensTotal = tokensAll._sum.tokens || 0

    return NextResponse.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          activeRate: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 1000) / 10 : 0,
          growth: wowGrowth(usersThisWeek, usersLastWeek),
        },
        conversations: {
          // 当前以「AI 调用次数」作为活动量（会话本身存于浏览器本地）
          total: apiTotal,
          today: apiToday,
          growth: wowGrowth(apiThisWeek, apiLastWeek),
        },
        tokens: {
          total: tokensTotal,
          today: tokensToday._sum.tokens || 0,
          growth: wowGrowth(
            tokensThisWeek._sum.tokens || 0,
            tokensLastWeek._sum.tokens || 0
          ),
        },
        // 每次调用对应一问一答
        messages: {
          user: apiTotal,
          assistant: apiTotal,
          system: 0,
        },
        userGrowth,
        recentActivities: recentUsers.map((u) => ({
          id: u.id,
          user: u.name,
          action: "注册了账号",
          time: getRelativeTime(u.createdAt),
          avatar: u.name[0],
        })),
      },
    })
  } catch (error) {
    console.error("Get stats error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 }
    )
  }
}

function getRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "刚刚"
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  return `${days}天前`
}
