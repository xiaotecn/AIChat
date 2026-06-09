"use client"

import { useEffect, useState } from "react"
import { Smartphone } from "lucide-react"
import { useChatStore } from "@/lib/store"
import { useSiteName } from "@/components/site-name-provider"

// 普通用户限定移动端：在「电脑端」（宽屏 + 鼠标精确指针）对 role==='user' 显示全屏提示，遮住聊天等页面。
// 管理员不受限（仍需用电脑进后台）；未登录/角色未知时不拦截。仅前端遮罩，非安全边界。
export function MobileOnlyGate() {
  const user = useChatStore((s) => s.user)
  const siteName = useSiteName()
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    // 宽屏且为精确指针（鼠标）→ 视为电脑端；手机/平板为粗略指针(coarse)，不会命中
    const mq = window.matchMedia("(min-width: 768px) and (pointer: fine)")
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  if (!user || user.role === "admin" || !isDesktop) return null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-white px-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/30">
        <Smartphone className="h-10 w-10" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900">请使用手机访问</h1>
      <p className="max-w-sm text-sm leading-relaxed text-gray-500">
        {siteName} 仅支持在手机上使用，请用手机打开本网址继续。
      </p>
    </div>
  )
}
