import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";
import { getSiteName } from "@/lib/settings";
import { SiteNameProvider } from "@/components/site-name-provider";

const inter = Inter({ subsets: ["latin"] });

// 站点名称在根布局按请求从数据库读取（generateMetadata + 布局），
// 强制动态渲染以保证后台改名后刷新即生效，不被构建期静态快照固化。
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName();
  return {
    title: `${siteName} - 智能对话助手`,
    description: "现代化的 AI 聊天应用",
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: siteName,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#2563eb",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteName = await getSiteName();
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <SiteNameProvider value={siteName}>{children}</SiteNameProvider>
        <Toaster />
      </body>
    </html>
  );
}
