"use client"

import Link from "next/link"
import { ChevronLeft, Info } from "lucide-react"
import { useChatStore } from "@/lib/store"
import { useSiteName } from "@/components/site-name-provider"

const ICON_BTN_SHADOW = "0 1px 8px rgba(0,0,0,.05), inset 0 0 0 1px #eef0f3"

export default function ProfileSettingsPage() {
  const siteName = useSiteName()

  async function handleLogout() {
    if (!confirm("确定要退出账号吗？")) return
    await fetch("/api/auth/logout", { method: "POST" })
    useChatStore.getState().setUser(null)
    window.location.href = "/login"
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#e9eaec" }}>
      <div
        className="mx-auto min-h-full w-full max-w-[430px] bg-[#f6f7f9] px-4 pb-8"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        {/* 顶栏 */}
        <nav className="mb-[18px] grid h-11 grid-cols-[44px_1fr_44px] items-center">
          <Link
            href="/profile"
            aria-label="返回个人中心"
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white text-[#202124]"
            style={{ boxShadow: ICON_BTN_SHADOW }}
          >
            <ChevronLeft className="h-[23px] w-[23px]" strokeWidth={2.6} />
          </Link>
          <div className="text-center text-[18px] font-bold text-[#202124]">设置</div>
          <div />
        </nav>

        {/* 关于我们 */}
        <section className="overflow-hidden rounded-[14px] bg-white">
          <div className="flex min-h-[66px] items-center gap-[13px] px-[18px] text-[17px] font-semibold text-[#202124]">
            <Info className="h-[26px] w-[26px] shrink-0 text-[#24262b]" strokeWidth={2.1} />
            关于我们
            <span className="ml-auto text-[14px] font-medium text-[#8c8f96]">{siteName}</span>
          </div>
        </section>

        {/* 退出账号 */}
        <button
          type="button"
          onClick={handleLogout}
          className="mt-[18px] h-[52px] w-full rounded-[14px] bg-white text-[17px] font-bold text-[#e5484d]"
        >
          退出账号
        </button>
        <div className="mt-[18px] text-center text-[13px] text-[#b2b5bc]">{siteName} · Version 1.0.0</div>
      </div>
    </div>
  )
}
