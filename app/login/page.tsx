"use client"

import { useState } from "react"
import Link from "next/link"
import { Sparkles } from "lucide-react"
import { useSiteName } from "@/components/site-name-provider"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const siteName = useSiteName()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const result = await res.json()
      if (result.success) {
        // 整页跳转：让 proxy 重新校验并由 AuthGate 拉取用户信息
        window.location.href = result.data.role === "admin" ? "/admin" : "/chat"
      } else {
        setError(result.error || "登录失败")
        setLoading(false)
      }
    } catch {
      setError("网络错误，请稍后重试")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-xl shadow-blue-500/30 mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">登录 {siteName}</h1>
          <p className="text-sm text-gray-500 mt-1">欢迎回来，请登录你的账号</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-xl p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              autoComplete="email"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50"
          >
            {loading ? "登录中..." : "登录"}
          </button>

          <p className="text-center text-sm text-gray-500">
            还没有账号？{" "}
            <Link href="/register" className="text-blue-600 font-medium hover:underline">
              立即注册
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
