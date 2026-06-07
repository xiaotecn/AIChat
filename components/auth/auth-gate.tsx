"use client"

import { useEffect } from "react"
import { useChatStore } from "@/lib/store"

// 在受保护的布局中挂载：拉取当前登录用户并注入全局 store，供 UI 使用。
// 路由层面的拦截由 proxy.ts 负责，这里只负责水合用户信息（统一走 store.loadUser）。
export function AuthGate() {
  const loadUser = useChatStore((s) => s.loadUser)

  useEffect(() => {
    loadUser()
  }, [loadUser])

  return null
}
