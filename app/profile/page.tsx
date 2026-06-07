"use client"

import { useChatStore } from "@/lib/store"
import { ArrowLeft, UserCog, Settings, LogOut, ChevronRight, Crown, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { useSiteName } from "@/components/site-name-provider"
import { cn } from "@/lib/utils"

// 统一的菜单行：彩色图标徽章 + 标题 +（链接行）右箭头；支持链接或按钮（退出登录）
function MenuRow({
  icon: Icon,
  chip,
  label,
  href,
  onClick,
  danger = false,
  last = false,
}: {
  icon: LucideIcon
  chip: string
  label: string
  href?: string
  onClick?: () => void
  danger?: boolean
  last?: boolean
}) {
  const cls = cn(
    "flex w-full items-center gap-3 px-4 py-3.5 text-left transition",
    !last && "border-b border-gray-100 dark:border-gray-800",
    danger ? "hover:bg-red-50 dark:hover:bg-red-950/30" : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
  )
  const content = (
    <>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", chip)}>
        <Icon className="h-5 w-5" />
      </span>
      <span
        className={cn(
          "flex-1 font-medium",
          danger ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"
        )}
      >
        {label}
      </span>
      {!danger && <ChevronRight className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" />}
    </>
  )
  if (href) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {content}
    </button>
  )
}

export default function ProfilePage() {
  const { user } = useChatStore()
  const siteName = useSiteName()

  const initial = user?.name?.[0]?.toUpperCase() || "U"
  const roleLabel = user?.role === "admin" ? "管理员" : "普通用户"

  async function handleLogout() {
    if (!confirm("确定要退出登录吗？")) return
    await fetch("/api/auth/logout", { method: "POST" })
    useChatStore.getState().setUser(null)
    window.location.href = "/login"
  }

  return (
    <div className="flex h-full flex-col bg-gray-50 dark:bg-gray-950">
      <div className="flex-1 overflow-y-auto">
        {/* 渐变 hero：返回 + 标题 + 用户信息（点击进账号管理） */}
        <div className="bg-gradient-to-br from-blue-600 to-cyan-500 px-5 pb-16 text-white" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}>
          <div className="flex items-center gap-2">
            <Link
              href="/chat"
              className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/15"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="flex-1 text-base font-semibold">个人中心</h1>
          </div>

          <Link href="/profile/edit" className="mt-3 flex items-center gap-4 rounded-2xl p-1 transition hover:bg-white/10">
            {user?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar}
                alt=""
                className="h-16 w-16 shrink-0 rounded-full object-cover ring-4 ring-white/30"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20 text-2xl font-bold text-white ring-4 ring-white/30">
                {initial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-xl font-bold">{user?.name || "游客"}</h2>
                <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium">
                  {roleLabel}
                </span>
              </div>
              <p className="truncate text-sm text-white/80">{user?.email || "未登录"}</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-white/70" />
          </Link>
        </div>

        {/* 内容：上移与 hero 叠压 */}
        <div className="px-5 pb-10">
          <div className="mx-auto -mt-9 w-full max-w-md space-y-4">
            {/* 菜单卡 */}
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-gray-900">
              <MenuRow
                icon={Crown}
                chip="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                label="订阅与用量"
                href="/profile/subscription"
              />
              <MenuRow
                icon={UserCog}
                chip="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                label="账号管理"
                href="/profile/edit"
              />
              {user?.role === "admin" && (
                <MenuRow
                  icon={Settings}
                  chip="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                  label="管理后台"
                  href="/admin"
                />
              )}
              <MenuRow
                icon={LogOut}
                chip="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                label="退出登录"
                onClick={handleLogout}
                danger
                last
              />
            </div>

            <p className="pt-2 text-center text-xs text-gray-400">{siteName} v1.0.0</p>
          </div>
        </div>
      </div>
    </div>
  )
}
