"use client"

import { createContext, useContext, type ReactNode } from "react"

// 站点名称由根布局在服务端从系统设置读取后注入，全站（含未登录页）一致展示——
// 无需客户端请求（/api/* 要登录，登录页拿不到），SSR 即带正确值，无闪烁。
const SiteNameContext = createContext<string>("AI Chat")

export function SiteNameProvider({
  value,
  children,
}: {
  value: string
  children: ReactNode
}) {
  return <SiteNameContext.Provider value={value}>{children}</SiteNameContext.Provider>
}

export function useSiteName(): string {
  return useContext(SiteNameContext)
}
