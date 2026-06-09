import { redirect } from "next/navigation"

// 首页不再有落地页：统一由 proxy.ts 按登录态跳转（已登录 → /chat 或 /admin；未登录 → /login）。
// 这里仅作兜底——万一直达且未被 proxy 拦截，也回到聊天页（未登录会被 proxy 再次拦去登录页）。
export default function HomePage() {
  redirect("/chat")
}
