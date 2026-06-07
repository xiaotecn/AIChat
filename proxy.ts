import { NextRequest, NextResponse } from "next/server"
import { decryptSession } from "@/lib/session"

// Next.js 16：Middleware 已更名为 Proxy。运行于 Node 运行时，可在此校验签名令牌。
// 令牌经 HMAC 签名，role 声明不可伪造，因此这里的校验属于真实拦截（非仅 UI 乐观判断）。

// 需要登录的普通页面
const APP_PAGES = ["/chat", "/history", "/profile"]

function isAppPage(path: string): boolean {
  return APP_PAGES.some((p) => path === p || path.startsWith(p + "/"))
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const token = req.cookies.get("session")?.value
  const session = await decryptSession(token)
  const isApi = path.startsWith("/api/")

  // 认证相关接口始终放行
  if (path.startsWith("/api/auth")) {
    return NextResponse.next()
  }

  // 后台接口：必须为管理员
  if (path.startsWith("/api/admin")) {
    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "未授权" },
        { status: 401 }
      )
    }
    return NextResponse.next()
  }

  // 其余业务接口（chat/models/conversations/messages）：需登录
  if (isApi) {
    if (!session) {
      return NextResponse.json(
        { success: false, error: "未登录" },
        { status: 401 }
      )
    }
    return NextResponse.next()
  }

  // 后台页面：未登录跳登录；已登录非管理员跳聊天
  if (path.startsWith("/admin")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", req.nextUrl))
    }
    if (session.role !== "admin") {
      return NextResponse.redirect(new URL("/chat", req.nextUrl))
    }
    return NextResponse.next()
  }

  // 普通应用页面：需登录
  if (isAppPage(path) && !session) {
    return NextResponse.redirect(new URL("/login", req.nextUrl))
  }

  // 已登录用户访问登录/注册页 → 跳转到对应首页
  if ((path === "/login" || path === "/register") && session) {
    const dest = session.role === "admin" ? "/admin" : "/chat"
    return NextResponse.redirect(new URL(dest, req.nextUrl))
  }

  return NextResponse.next()
}

// 静态资源不经过 proxy
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.png$|.*\\.svg$|.*\\.ico$).*)",
  ],
}
