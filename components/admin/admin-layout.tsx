"use client"

import { ReactNode, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Bot,
  Boxes,
  FileText,
  Settings,
  ChevronRight,
  LogOut,
  Menu,
  X,
} from "lucide-react"
import { useChatStore } from "@/lib/store"
import { AuthGate } from "@/components/auth/auth-gate"
import { useSiteName } from "@/components/site-name-provider"

interface AdminLayoutProps {
  children: ReactNode
}

const navigation = [
  { name: "数据看板", href: "/admin", icon: LayoutDashboard },
  { name: "用户管理", href: "/admin/users", icon: Users },
  { name: "套餐管理", href: "/admin/plans", icon: CreditCard },
  { name: "AI 接口", href: "/admin/providers", icon: Bot },
  { name: "模型分组", href: "/admin/model-groups", icon: Boxes },
  { name: "调用日志", href: "/admin/logs", icon: FileText },
  { name: "系统设置", href: "/admin/settings", icon: Settings },
]

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname()
  const user = useChatStore((s) => s.user)
  const siteName = useSiteName()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    useChatStore.getState().setUser(null)
    window.location.href = "/login"
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <AuthGate />

      {/* 移动端遮罩：点击关闭侧栏 */}
      {sidebarOpen && (
        <button
          aria-label="关闭菜单"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}

      {/* 侧边导航栏：移动端为可滑出抽屉，md+ 固定常驻 - Fluent 2 亚克力风格 */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex-shrink-0 transform transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col backdrop-blur-xl bg-white/70 border-r border-white/50 shadow-xl">
          {/* Logo 区域 */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-white/30">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <span className="text-white font-bold text-lg">AI</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-gray-900 truncate">{siteName}</h1>
                <p className="text-xs text-gray-500">管理控制台</p>
              </div>
            </div>
            {/* 移动端关闭按钮 */}
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="关闭"
              className="md:hidden -mr-2 p-1.5 rounded-lg text-gray-500 hover:bg-white/60"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 导航菜单 */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    group relative flex items-center gap-3 px-4 py-3 rounded-xl
                    transition-all duration-200 ease-out
                    ${isActive
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-700 hover:bg-white/60 hover:shadow-md'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 ${isActive ? '' : 'text-gray-600'}`} />
                  <span className="font-medium text-sm">{item.name}</span>

                  {isActive && (
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* 底部用户信息 */}
          <div className="p-4 border-t border-white/30">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/40 backdrop-blur">
              <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
                {user?.name?.[0]?.toUpperCase() || "A"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name || "管理员"}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email || ""}</p>
              </div>
              <button
                onClick={handleLogout}
                title="退出登录"
                className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* 主内容区域 */}
      <main className="flex-1 overflow-y-auto">
        {/* 顶部栏 */}
        <header className="h-16 backdrop-blur-xl bg-white/50 border-b border-white/50 sticky top-0 z-10">
          <div className="h-full px-4 md:px-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {/* 移动端汉堡按钮 */}
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="打开菜单"
                className="md:hidden -ml-1 p-2 rounded-lg text-gray-700 hover:bg-white/60"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h2 className="text-lg md:text-xl font-semibold text-gray-900 truncate">
                  {navigation.find(item => item.href === pathname)?.name || "管理后台"}
                </h2>
                <p className="hidden sm:block text-sm text-gray-500">欢迎回来，管理您的 AI 应用</p>
              </div>
            </div>

            {/* 右侧操作区 */}
            <div className="flex items-center gap-4 shrink-0">
              <button
                onClick={() => window.location.reload()}
                className="px-3 md:px-4 py-2 rounded-lg bg-white/60 hover:bg-white/80 text-gray-700 text-sm font-medium transition-all backdrop-blur shadow-sm hover:shadow"
              >
                刷新数据
              </button>
            </div>
          </div>
        </header>

        {/* 内容区域 */}
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
