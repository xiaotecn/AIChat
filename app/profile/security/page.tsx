"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { useChatStore } from "@/lib/store"
import { toast } from "@/components/ui/toast"

const ICON_BTN_SHADOW = "0 1px 8px rgba(0,0,0,.05), inset 0 0 0 1px #eef0f3"

export default function ProfileSecurityPage() {
  const router = useRouter()
  const loadUser = useChatStore((s) => s.loadUser)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return

    if (!currentPassword) {
      toast.error("请输入当前密码")
      return
    }
    if (newPassword.length < 6) {
      toast.error("新密码至少 6 位")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })
      const result = await res.json().catch(() => null)
      if (!res.ok || !result?.success) {
        toast.error(result?.error || "密码修改失败，请稍后重试")
        return
      }
      await loadUser()
      toast.success("密码修改成功")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      router.push("/profile")
    } catch {
      toast.error("密码修改失败，请稍后重试")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#e9eaec" }}>
      <div
        className="mx-auto min-h-full w-full max-w-[430px] bg-[#f6f7f9] px-4 pb-8"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        {/* 顶栏 */}
        <nav className="mb-[18px] grid h-11 grid-cols-[44px_1fr_44px] items-center">
          <Link
            href="/profile"
            aria-label="返回个人中心"
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white text-[#202124]"
            style={{ boxShadow: ICON_BTN_SHADOW }}
          >
            <ChevronLeft className="h-[23px] w-[23px]" strokeWidth={2.6} />
          </Link>
          <div className="text-center text-[18px] font-bold text-[#202124]">账号安全</div>
          <div />
        </nav>

        {/* 修改密码表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="space-y-3 rounded-[14px] bg-white p-5">
            <div className="mb-1">
              <h3 className="text-[17px] font-semibold text-[#202124]">修改密码</h3>
              <p className="mt-1 text-[13px] text-[#8c8f96]">为了账号安全，请定期修改密码</p>
            </div>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="当前密码"
              autoComplete="current-password"
              className="w-full rounded-xl border border-[#e0e2e7] px-4 py-3 text-[15px] outline-none focus:border-[#2f8df4] focus:ring-2 focus:ring-[#2f8df4]/20"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="新密码，至少 6 位"
              autoComplete="new-password"
              className="w-full rounded-xl border border-[#e0e2e7] px-4 py-3 text-[15px] outline-none focus:border-[#2f8df4] focus:ring-2 focus:ring-[#2f8df4]/20"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入新密码"
              autoComplete="new-password"
              className="w-full rounded-xl border border-[#e0e2e7] px-4 py-3 text-[15px] outline-none focus:border-[#2f8df4] focus:ring-2 focus:ring-[#2f8df4]/20"
            />
          </section>

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <Link
              href="/profile"
              className="flex-1 rounded-[14px] bg-white py-3 text-center text-[16px] font-semibold text-[#202124] shadow-sm"
            >
              取消
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-[14px] bg-[#2f8df4] py-3 text-[16px] font-semibold text-white shadow-sm transition hover:bg-[#1e7de3] disabled:opacity-50"
            >
              {saving ? "保存中…" : "确认修改"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
