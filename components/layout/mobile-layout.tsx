"use client"

import { ReactNode } from "react"
import { AuthGate } from "@/components/auth/auth-gate"

interface MobileLayoutProps {
  children: ReactNode
}

export function MobileLayout({ children }: MobileLayoutProps) {
  return (
    <div className="fixed inset-0 bg-white md:flex md:items-center md:justify-center md:bg-gradient-to-b md:from-gray-100 md:to-gray-200 md:p-6">
      <AuthGate />
      {/* 移动端：全屏铺满（用系统真实刘海/安全区）；桌面端(md+)：居中手机外框预览 */}
      <div className="relative h-full w-full overflow-hidden bg-white md:h-[844px] md:w-[390px] md:rounded-[40px] md:border-[14px] md:border-gray-900 md:shadow-2xl">
        {/* 假刘海：仅桌面预览显示；真机用系统刘海，不再叠加 */}
        <div className="absolute left-1/2 top-0 z-50 hidden h-[30px] w-[150px] -translate-x-1/2 rounded-b-3xl bg-gray-900 md:block" />

        {/* 主内容区域 */}
        <main className="h-full overflow-hidden bg-gradient-to-b from-gray-50 to-white">
          {children}
        </main>
      </div>
    </div>
  )
}
