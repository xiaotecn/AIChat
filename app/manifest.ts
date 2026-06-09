import type { MetadataRoute } from "next"
import { getBrand } from "@/lib/settings"

// 动态 Web App Manifest：名称随后台「网站名称」实时变化（添加到主屏幕/PWA 的名字）。
// 图标用从 Logo 生成的方形 PNG（public/icon-*.png）。强制动态，避免被构建期固化成旧名字。
export const dynamic = "force-dynamic"

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { siteName } = await getBrand()
  return {
    name: siteName,
    short_name: siteName,
    description: "现代化的 AI 聊天应用",
    start_url: "/chat",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }
}
