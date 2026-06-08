"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useChatStore } from "@/lib/store"

// 会话守卫 + 准实时刷新（挂在受保护布局 MobileLayout / AdminLayout）：
//  - 拉取当前用户注入 store；未登录(401) 或会话中途失效 → 强制跳 /login
//  - 回到前台 / 每 30s：router.refresh() 刷新服务端数据（如站名/公告）+ 复核登录态
// 路由硬拦截仍由 proxy.ts 负责；这里补足「页面已加载后登录态失效」的场景。
export function AuthGate() {
  const router = useRouter()
  const loadUser = useChatStore((s) => s.loadUser)
  const user = useChatStore((s) => s.user)
  const hadUser = useRef(false)

  useEffect(() => {
    const check = () => {
      loadUser().then((ok) => {
        if (!ok) router.replace("/login")
      })
    }
    check()

    const onFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      router.refresh()
      check()
    }
    document.addEventListener("visibilitychange", onFocus)
    window.addEventListener("focus", onFocus)
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh()
        check()
      }
    }, 30000)
    return () => {
      document.removeEventListener("visibilitychange", onFocus)
      window.removeEventListener("focus", onFocus)
      clearInterval(timer)
    }
  }, [loadUser, router])

  // 曾登录后 user 变 null（会话失效）→ 强制跳登录
  useEffect(() => {
    if (user) hadUser.current = true
    else if (hadUser.current) router.replace("/login")
  }, [user, router])

  return null
}
