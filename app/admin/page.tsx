"use client"

import { AdminLayout } from "@/components/admin/admin-layout"
import { Users, MessageSquare, TrendingUp, Zap } from "lucide-react"
import { useEffect, useState } from "react"

interface StatsData {
  users: { total: number; active: number; activeRate: number; growth: number }
  conversations: { total: number; today: number; growth: number }
  tokens: { total: number; today: number; growth: number }
  messages: { user: number; assistant: number; system: number }
  userGrowth: { date: string; count: number }[]
  recentActivities: { id: string; user: string; action: string; time: string; avatar: string }[]
}

export default function AdminDashboard() {
  const [statsData, setStatsData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setStatsData(result.data)
        }
      })
      .catch(err => console.error('获取统计数据失败:', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">加载中...</div>
        </div>
      </AdminLayout>
    )
  }

  if (!statsData) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-red-500">加载失败</div>
        </div>
      </AdminLayout>
    )
  }

  const fmtGrowth = (g: number) => (g >= 0 ? `+${g}%` : `${g}%`)

  const stats = [
    {
      name: "总用户数",
      value: statsData.users.total.toLocaleString(),
      change: fmtGrowth(statsData.users.growth),
      changeLabel: "较上周",
      trend: "up",
      icon: Users,
      color: "from-blue-500 to-cyan-500"
    },
    {
      name: "活跃用户",
      value: statsData.users.active.toLocaleString(),
      change: `${statsData.users.activeRate}%`,
      changeLabel: "活跃占比",
      trend: "up",
      icon: TrendingUp,
      color: "from-purple-500 to-pink-500"
    },
    {
      name: "AI 调用数",
      value: statsData.conversations.total.toLocaleString(),
      change: fmtGrowth(statsData.conversations.growth),
      changeLabel: "较上周",
      trend: "up",
      icon: MessageSquare,
      color: "from-green-500 to-teal-500"
    },
    {
      name: "Token 消耗",
      value: (statsData.tokens.total / 1000000).toFixed(2) + "M",
      change: fmtGrowth(statsData.tokens.growth),
      changeLabel: "较上周",
      trend: "up",
      icon: Zap,
      color: "from-orange-500 to-red-500"
    },
  ]

  const maxGrowthCount = Math.max(1, ...statsData.userGrowth.map((d) => d.count))

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* 统计卡片网格 - Fluent 2 亚克力卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.name}
                className="group relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                {/* 渐变背景装饰 */}
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-5 group-hover:opacity-10 transition-opacity`} />

                <div className="relative p-6">
                  {/* 图标 */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4 shadow-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  {/* 数据 */}
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-green-600">{stat.change}</span>
                      <span className="text-xs text-gray-500">{stat.changeLabel}</span>
                    </div>
                  </div>
                </div>

                {/* 高光效果 */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
              </div>
            )
          })}
        </div>

        {/* 图表区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 用户增长趋势 */}
          <div className="rounded-2xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-lg p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">用户增长趋势</h3>
              <p className="text-sm text-gray-500 mt-1">最近 7 天新增用户</p>
            </div>

            {/* 简单的柱状图模拟 */}
            <div className="flex items-end justify-between h-48 gap-2">
              {statsData.userGrowth.map((day, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-medium text-gray-600">{day.count}</span>
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 transition-all cursor-pointer shadow-lg"
                    style={{ height: `${Math.max(4, (day.count / maxGrowthCount) * 100)}%` }}
                  />
                  <span className="text-xs text-gray-500">{day.date}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 消息统计 */}
          <div className="rounded-2xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-lg p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">消息统计</h3>
              <p className="text-sm text-gray-500 mt-1">今日消息分布</p>
            </div>

            <div className="space-y-4">
              {[
                { label: "用户消息", value: statsData.messages.user, percent: (statsData.messages.user / (statsData.messages.user + statsData.messages.assistant + statsData.messages.system)) * 100, color: "from-blue-500 to-cyan-500" },
                { label: "AI 回复", value: statsData.messages.assistant, percent: (statsData.messages.assistant / (statsData.messages.user + statsData.messages.assistant + statsData.messages.system)) * 100, color: "from-purple-500 to-pink-500" },
                { label: "系统消息", value: statsData.messages.system, percent: (statsData.messages.system / (statsData.messages.user + statsData.messages.assistant + statsData.messages.system)) * 100, color: "from-gray-400 to-gray-500" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-gray-700">{item.label}</span>
                    <span className="text-gray-900 font-semibold">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200/50 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${item.color} transition-all duration-500`}
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 最近活动 */}
        <div className="rounded-2xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">最近活动</h3>

          <div className="space-y-3">
            {statsData.recentActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-white/40 hover:bg-white/60 transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold shadow-md">
                  {activity.avatar}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">
                    <span className="font-semibold">{activity.user}</span>
                    <span className="text-gray-600"> {activity.action}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
