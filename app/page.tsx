import Link from "next/link"
import { MessageSquare, LayoutDashboard, Sparkles } from "lucide-react"
import { getSiteName } from "@/lib/settings"

export default async function HomePage() {
  const siteName = await getSiteName()
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        {/* 头部 */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-2xl shadow-blue-500/30 mb-6">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">{siteName}</h1>
          <p className="text-xl text-gray-600">现代化的 AI 聊天应用</p>
          <p className="text-sm text-gray-500 mt-2">基于 Next.js 15 + React 19 + Fluent 2 设计</p>
        </div>

        {/* 功能卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 移动端 */}
          <Link
            href="/chat"
            className="group relative overflow-hidden rounded-3xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 p-8"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-6">
                <MessageSquare className="w-8 h-8 text-white" />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-3">移动端聊天</h2>
              <p className="text-gray-600 mb-4">
                专为移动设备优化的聊天界面，支持侧边抽屉导航、会话管理、Markdown 渲染
              </p>

              <div className="flex flex-wrap gap-2 mb-6">
                <span className="px-3 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-semibold">侧边抽屉</span>
                <span className="px-3 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-semibold">会话管理</span>
                <span className="px-3 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-semibold">Markdown</span>
              </div>

              <div className="flex items-center text-blue-600 font-medium group-hover:gap-2 transition-all">
                <span>立即体验</span>
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          </Link>

          {/* 管理后台 */}
          <Link
            href="/admin"
            className="group relative overflow-hidden rounded-3xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 p-8"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30 mb-6">
                <LayoutDashboard className="w-8 h-8 text-white" />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-3">管理后台</h2>
              <p className="text-gray-600 mb-4">
                Fluent 2 风格的管理控制台，支持用户管理、套餐配置、AI 接口管理和数据统计
              </p>

              <div className="flex flex-wrap gap-2 mb-6">
                <span className="px-3 py-1 rounded-lg bg-purple-100 text-purple-700 text-xs font-semibold">Fluent 2</span>
                <span className="px-3 py-1 rounded-lg bg-purple-100 text-purple-700 text-xs font-semibold">数据看板</span>
                <span className="px-3 py-1 rounded-lg bg-purple-100 text-purple-700 text-xs font-semibold">用户管理</span>
              </div>

              <div className="flex items-center text-purple-600 font-medium group-hover:gap-2 transition-all">
                <span>进入管理</span>
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          </Link>
        </div>

        {/* 技术栈 */}
        <div className="mt-12 rounded-3xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-xl p-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 text-center">技术栈</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600 mb-1">Next.js 15</p>
              <p className="text-xs text-gray-500">App Router</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-cyan-600 mb-1">React 19</p>
              <p className="text-xs text-gray-500">UI Library</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600 mb-1">TypeScript</p>
              <p className="text-xs text-gray-500">Type Safety</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-pink-600 mb-1">Tailwind CSS</p>
              <p className="text-xs text-gray-500">Styling</p>
            </div>
          </div>
        </div>

        {/* 底部说明 */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            📱 移动端采用侧边抽屉导航 | 🖥️ 管理后台采用 Fluent 2 设计语言
          </p>
        </div>
      </div>
    </div>
  )
}
