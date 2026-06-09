"use client"

import { createContext, useContext, type ReactNode } from "react"

// 站点品牌（名称 + Logo）由根布局在服务端从系统设置读取后注入，全站（含未登录页）一致展示——
// 无需客户端请求（/api/* 要登录，登录页拿不到），SSR 即带正确值，无闪烁。
interface Brand {
  siteName: string
  logoUrl: string | null
}

const BrandContext = createContext<Brand>({ siteName: "AI Chat", logoUrl: null })

export function SiteNameProvider({
  value,
  children,
}: {
  value: Brand
  children: ReactNode
}) {
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
}

export function useSiteName(): string {
  return useContext(BrandContext).siteName
}

export function useLogoUrl(): string | null {
  return useContext(BrandContext).logoUrl
}
