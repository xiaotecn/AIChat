"use client"

import { useState } from "react"
import Link from "next/link"
import { Sparkles } from "lucide-react"
import { useSiteName } from "@/components/site-name-provider"

export default function RegisterPage() {
  const [name, setName] = useState("")
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      })
      const result = await res.json()
      if (result.success) {
        window.location.href = "/chat"
      } else {
        setError(result.error || "注册失败")
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
          <h1 className="text-2xl font-bold text-gray-900">注册 {siteName}</h1>
          <p className="text-sm text-gray-500 mt-1">创建你的账号，开始智能对话</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-xl p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">姓名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="你的昵称"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
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
              placeholder="至少 6 位"
              autoComplete="new-password"
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
            {loading ? "注册中..." : "注册"}
          </button>

          <p className="text-center text-sm text-gray-500">
            已有账号？{" "}
            <Link href="/login" className="text-blue-600 font-medium hover:underline">
              去登录
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
