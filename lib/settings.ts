import { cache } from "react"
import { prisma } from "@/lib/prisma"

const DEFAULT_SITE_NAME = "AI Chat"

export interface Brand {
  siteName: string
  logoUrl: string | null
}

// 读取系统品牌（网站名 + Logo），按请求缓存，供根布局注入全站（含未登录页）。
// 读取失败或未配置时回退默认值，保证页面永远有标题。
export const getBrand = cache(async (): Promise<Brand> => {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "default" },
      select: { siteName: true, logoUrl: true },
    })
    return {
      siteName: settings?.siteName?.trim() || DEFAULT_SITE_NAME,
      logoUrl: settings?.logoUrl?.trim() || null,
    }
  } catch {
    return { siteName: DEFAULT_SITE_NAME, logoUrl: null }
  }
})

// 仅取网站名称（generateMetadata 等只需名字时用）；底层复用已缓存的 getBrand，不额外查询。
export const getSiteName = async (): Promise<string> => (await getBrand()).siteName
