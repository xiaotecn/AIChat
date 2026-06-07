import { cache } from "react"
import { prisma } from "@/lib/prisma"

const DEFAULT_SITE_NAME = "AI Chat"

// 读取系统设置里的网站名称（按请求缓存，供根布局的 metadata 与各服务端组件复用，避免重复查询）。
// 读取失败或未配置时回退默认值，保证页面永远有标题。
export const getSiteName = cache(async (): Promise<string> => {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "default" },
      select: { siteName: true },
    })
    return settings?.siteName?.trim() || DEFAULT_SITE_NAME
  } catch {
    return DEFAULT_SITE_NAME
  }
})
