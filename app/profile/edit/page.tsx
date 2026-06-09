"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Camera, Trash2 } from "lucide-react"
import { useChatStore } from "@/lib/store"
import { downscaleImageToDataUrl } from "@/lib/image"
import { toast } from "@/components/ui/toast"

// 账号名称：中文 / 英文 / 数字 / 下划线 / 短横线，1–15 位（与后端 PATCH 校验一致）
const NAME_PATTERN = /^[一-龥A-Za-z0-9_-]{1,15}$/

export default function ProfileEditPage() {
  const router = useRouter()
  const user = useChatStore((s) => s.user)
  const loadUser = useChatStore((s) => s.loadUser)

  const [hydrated, setHydrated] = useState(false)
  const [name, setName] = useState("")
  const [avatar, setAvatar] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // 用户信息到达后，把表单初始值水合一次（AuthGate 在布局层已拉取，通常 mount 即有）
  useEffect(() => {
    if (user && !hydrated) {
      setName(user.name ?? "")
      setAvatar(user.avatar ?? null)
      setHydrated(true)
    }
  }, [user, hydrated])

  async function handlePickAvatar(file: File | null | undefined) {
    if (!file) return
    try {
      const dataUrl = await downscaleImageToDataUrl(file)
      setAvatar(dataUrl)
    } catch (e) {
      toast.error((e as Error).message || "图片处理失败")
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return

    const nextName = name.trim()
    if (!NAME_PATTERN.test(nextName)) {
      toast.error("账号名称只支持中文、英文、数字、下划线和短横线，1–15 字")
      return
    }

    const body: {
      name: string
      avatar?: string | null
    } = { name: nextName }
    // 头像有变化才发送（含「移除」= null）；未变则不传，避免无谓写库
    if (avatar !== (user?.avatar ?? null)) {
      body.avatar = avatar
    }

    setSaving(true)
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const result = await res.json().catch(() => null)
      if (!res.ok || !result?.success) {
        toast.error(result?.error || "保存失败，请稍后重试")
        return
      }
      await loadUser()
      toast.success("账号资料已保存")
      router.push("/profile")
    } catch {
      toast.error("保存失败，请稍后重试")
    } finally {
      setSaving(false)
    }
  }

  if (hydrated && !user) {
    return <div className="flex h-full items-center justify-center text-sm text-gray-500">请先登录</div>
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-blue-50 to-white dark:from-gray-950 dark:to-gray-950">
      {/* 顶部 */}
      <header
        className="flex items-center gap-3 border-b border-gray-200 bg-white/80 px-4 pb-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/80"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <Link
          href="/profile"
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-lg font-semibold">账号管理</h1>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 pb-8 pt-6">
        <div className="mx-auto w-full max-w-md space-y-5">
          {/* 头像 */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatar || "/seal.png"}
                alt=""
                className="h-24 w-24 rounded-full bg-white object-cover shadow-md"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#1a2333] text-white shadow-lg dark:border-gray-900"
                title="更换头像"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handlePickAvatar(e.target.files?.[0])
                  e.target.value = ""
                }}
              />
            </div>
            {avatar && (
              <button
                type="button"
                onClick={() => setAvatar(null)}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
                移除头像
              </button>
            )}
          </div>

          {/* 基本信息 */}
          <div className="space-y-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-gray-900">
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">账号名称</span>
              <div className="relative mt-1.5">
                <input
                  value={name}
                  maxLength={15}
                  onChange={(e) => setName(e.target.value.slice(0, 15))}
                  placeholder="请输入账号名称"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-14 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  {name.length}/15
                </span>
              </div>
              <p className="mt-1.5 text-xs text-gray-400">支持中文、英文、数字、下划线和短横线</p>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">邮箱账号</span>
              <input
                value={user?.email ?? ""}
                readOnly
                className="mt-1.5 w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-500 outline-none dark:border-gray-800 dark:bg-gray-800/50"
              />
            </label>
          </div>

          {/* 操作 */}
          <div className="flex gap-3">
            <Link
              href="/profile"
              className="flex-1 rounded-2xl border border-gray-300 bg-white py-3 text-center font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              取消
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-2xl bg-[#1a2333] py-3 font-semibold text-white transition hover:bg-[#2a3346] disabled:opacity-50"
            >
              {saving ? "保存中…" : "确认"}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
