"use client"

import { ReactNode } from "react"
import { AuthGate } from "@/components/auth/auth-gate"

interface MobileLayoutProps {
  children: ReactNode
}

export function MobileLayout({ children }: MobileLayoutProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-gray-100 to-gray-200 p-6">
      <AuthGate />
      {/* 手机框架 */}
      <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[40px] border-[14px] border-gray-900 bg-white shadow-2xl">
        {/* 顶部刘海 */}
        <div className="absolute left-1/2 top-0 z-50 h-[30px] w-[150px] -translate-x-1/2 rounded-b-3xl bg-gray-900" />

        {/* 主内容区域 */}
        <main className="h-full overflow-hidden bg-gradient-to-b from-gray-50 to-white">
          {children}
        </main>
      </div>
    </div>
  )
}
