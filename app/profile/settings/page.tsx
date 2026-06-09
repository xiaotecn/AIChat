"use client"

import Link from "next/link"
import { ChevronLeft, LogOut } from "lucide-react"
import { useChatStore } from "@/lib/store"

const ICON_BTN_SHADOW = "0 1px 8px rgba(0,0,0,.05), inset 0 0 0 1px #eef0f3"

export default function ProfileSettingsPage() {
  async function handleLogout() {
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

        {/* 设置项（后续在此继续扩展更多设置） */}
        <section className="overflow-hidden rounded-[14px] bg-white">
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-[58px] w-full items-center gap-[13px] px-5 text-[17px] font-semibold text-[#e5484d]"
          >
            <LogOut className="h-[22px] w-[22px] shrink-0" strokeWidth={2.1} />
            退出登录
          </button>
        </section>
      </div>
    </div>
  )
}
