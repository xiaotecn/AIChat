"use client"

import { useChatStore } from "@/lib/store"
import { ArrowLeft, Crown, Sparkles, MessageSquare, Database, Image as ImageIcon, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

// ISO → "YYYY-MM-DD"；无/非法返回 null
function toYMD(value?: string | null): string | null {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// 用量条目：彩色图标徽章 + 标题 + used/limit + 渐变进度条；limit < 0 视为无限
function UsageItem({
  icon: Icon,
  chip,
  bar,
  label,
  used,
  limit,
}: {
  icon: LucideIcon
  chip: string
  bar: string
  label: string
  used: number
  limit: number
}) {
  const unlimited = limit < 0
  const percent = unlimited || limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100))
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", chip)}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="flex-1 font-medium text-gray-900 dark:text-gray-100">{label}</span>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {used} <span className="font-normal text-gray-400">/ {unlimited ? "无限" : limit}</span>
        </span>
      </div>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r transition-all", bar)}
          style={{ width: `${unlimited ? 100 : percent}%` }}
        />
      </div>
    </div>
  )
}

export default function SubscriptionPage() {
  const { user } = useChatStore()

  const planName = user?.planName || "免费版"
  const isFree = !user?.planName || /免费|free/i.test(String(user?.planName))
  const expiryYmd = toYMD(user?.expiresAt)
  // 订阅副标题：有到期日→「有效期至 …」；付费无到期→长期有效；免费→不显示
  const planSubtitle = expiryYmd ? `有效期至 ${expiryYmd}` : isFree ? null : "长期有效"

  return (
    <div className="flex h-full flex-col bg-gray-50 dark:bg-gray-950">
      {/* 顶部导航（固定） */}
      <header
        className="flex items-center gap-3 border-b border-gray-200 bg-white/80 px-4 pb-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/80"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <Link
          href="/profile"
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-lg font-semibold">订阅与用量</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-10 pt-5">
        <div className="mx-auto w-full max-w-md space-y-4">
          {/* 订阅会员卡（深色 + 光晕） */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#20202a] to-[#0c0c12] p-5 shadow-lg shadow-black/20">
            <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-amber-400/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-14 -left-10 h-36 w-36 rounded-full bg-blue-500/10 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f6e3b6] to-[#e7c483] shadow-inner">
                <Crown className="h-6 w-6 text-[#5a4318]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-white">订阅会员</h3>
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-[#f6e3b6] to-[#e7c483] px-2 py-0.5 text-[11px] font-semibold text-[#5a4318]">
                    {planName}
                    <Sparkles className="h-3 w-3" />
                  </span>
                </div>
                {planSubtitle && <p className="mt-1 text-xs text-white/55">{planSubtitle}</p>}
              </div>
            </div>
          </div>

          {/* 使用情况 */}
          <div className="space-y-5 rounded-3xl bg-white p-5 shadow-sm dark:bg-gray-900">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">使用情况</h3>
            <UsageItem
              icon={MessageSquare}
              chip="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              bar="from-blue-500 to-cyan-500"
              label="消息数"
              used={user?.usedMessages || 0}
              limit={user?.messageLimit ?? 0}
            />
            <UsageItem
              icon={Database}
              chip="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
              bar="from-violet-500 to-fuchsia-500"
              label="Token 额度"
              used={user?.usedTokens || 0}
              limit={user?.tokenLimit ?? 0}
            />
            <UsageItem
              icon={ImageIcon}
              chip="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              bar="from-amber-500 to-orange-500"
              label="图片生成"
              used={user?.usedImages || 0}
              limit={user?.imageLimit ?? 0}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
