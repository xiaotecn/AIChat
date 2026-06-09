"use client"

import { AdminLayout } from "@/components/admin/admin-layout"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { downscaleImageToDataUrl } from "@/lib/image"

interface SettingsForm {
  siteName: string
  logoUrl: string
  description: string
  announcement: string
  registrationMode: string
  defaultPlanId: string
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPass: string
  smtpFrom: string
  smtpSecure: boolean
  requireEmailVerification: boolean
  allowedEmailDomains: string
}

interface PlanOption {
  id: string
  name: string
}

export default function AdminSettings() {
  const [form, setForm] = useState<SettingsForm>({
    siteName: "",
    logoUrl: "",
    description: "",
    announcement: "",
    registrationMode: "open",
    defaultPlanId: "",
    smtpHost: "",
    smtpPort: "",
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
    smtpSecure: true,
    requireEmailVerification: false,
    allowedEmailDomains: "",
  })
  const [plans, setPlans] = useState<PlanOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [smtpPassSet, setSmtpPassSet] = useState(false)
  const [testing, setTesting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/settings")
        const result = await res.json()
        if (result.success) {
          const s = result.data.settings
          setForm({
            siteName: s.siteName ?? "",
            logoUrl: s.logoUrl ?? "",
            description: s.description ?? "",
            announcement: s.announcement ?? "",
            registrationMode: s.registrationMode ?? "open",
            defaultPlanId: s.defaultPlanId ?? "",
            smtpHost: s.smtpHost ?? "",
            smtpPort: s.smtpPort != null ? String(s.smtpPort) : "",
            smtpUser: s.smtpUser ?? "",
            smtpPass: "", // 不回显密码
            smtpFrom: s.smtpFrom ?? "",
            smtpSecure: s.smtpSecure ?? true,
            requireEmailVerification: s.requireEmailVerification ?? false,
            allowedEmailDomains: s.allowedEmailDomains ?? "",
          })
          setSmtpPassSet(!!s.smtpPassSet)
          setPlans(result.data.plans ?? [])
        }
      } catch (error) {
        console.error("加载设置失败:", error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handlePickLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      const dataUrl = await downscaleImageToDataUrl(file, 256)
      setForm((prev) => ({ ...prev, logoUrl: dataUrl }))
    } catch (err) {
      alert((err as Error).message || "图片处理失败")
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const result = await res.json()
      if (result.success) {
        setSaved(true)
        // 让根布局重新读取品牌（站名/Logo）并刷新到当前页面，保存后立即生效，无需手动刷新
        router.refresh()
        setTimeout(() => setSaved(false), 2500)
      } else {
        alert("保存失败: " + result.error)
      }
    } catch (error) {
      alert("保存失败: " + error)
    } finally {
      setSaving(false)
    }
  }

  const handleTestSmtp = async () => {
    setTesting(true)
    try {
      const res = await fetch("/api/admin/settings/test-smtp", { method: "POST" })
      const result = await res.json()
      if (result.success) {
        alert(`测试邮件已发送到 ${result.data.to}，请查收（含垃圾箱）`)
      } else {
        alert("发送失败: " + result.error)
      }
    } catch (e) {
      alert("发送失败: " + e)
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="rounded-2xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-lg p-12 text-center">
          <p className="text-gray-500">加载中...</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* 基本设置 */}
        <div className="rounded-2xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">基本设置</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">网站名称</label>
              <input
                type="text"
                value={form.siteName}
                onChange={(e) => setForm({ ...form, siteName: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-white/50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">网站 Logo</label>
              <div className="flex items-center gap-4">
                {form.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.logoUrl}
                    alt="logo"
                    className="h-16 w-16 rounded-xl border border-gray-200 bg-white object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-gray-300 text-xs text-gray-400">
                    无
                  </div>
                )}
                <div className="flex flex-col items-start gap-2">
                  <label className="cursor-pointer rounded-lg border border-white/50 bg-white/70 px-4 py-2 text-sm text-gray-700 transition-all hover:bg-white">
                    上传图片
                    <input type="file" accept="image/*" className="hidden" onChange={handlePickLogo} />
                  </label>
                  {form.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, logoUrl: "" })}
                      className="text-xs text-gray-500 hover:text-red-600"
                    >
                      移除 Logo
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-400">用于登录页等品牌展示，建议正方形图片；留空则使用默认图标。</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">网站描述</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-white/50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">公告内容</label>
              <input
                type="text"
                value={form.announcement}
                onChange={(e) => setForm({ ...form, announcement: e.target.value })}
                placeholder="系统公告（留空则不显示）"
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-white/50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>
        </div>

        {/* 注册设置 */}
        <div className="rounded-2xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">注册设置</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">注册模式</label>
              <select
                value={form.registrationMode}
                onChange={(e) => setForm({ ...form, registrationMode: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-white/50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="open">开放注册</option>
                <option value="invite">邀请码注册</option>
                <option value="closed">关闭注册</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">默认套餐</label>
              <select
                value={form.defaultPlanId}
                onChange={(e) => setForm({ ...form, defaultPlanId: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-white/50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="">未设置</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 邮件 (SMTP) 与注册验证 */}
        <div className="rounded-2xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">邮件 (SMTP) 与注册验证</h3>

          <div className="space-y-4">
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-white/40 px-4 py-3">
              <span>
                <span className="block text-sm font-medium text-gray-700">注册需邮箱验证码</span>
                <span className="mt-0.5 block text-xs text-gray-400">开启后注册要先收取邮箱验证码（需配置下方 SMTP）</span>
              </span>
              <input
                type="checkbox"
                checked={form.requireEmailVerification}
                onChange={(e) => setForm({ ...form, requireEmailVerification: e.target.checked })}
                className="h-5 w-5 shrink-0 accent-blue-600"
              />
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">允许注册的邮箱域名</label>
              <input
                type="text"
                value={form.allowedEmailDomains}
                onChange={(e) => setForm({ ...form, allowedEmailDomains: e.target.value })}
                placeholder="如 qq.com,gmail.com（留空 = 不限制）"
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-white/50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <p className="mt-1 text-xs text-gray-400">多个域名用逗号分隔；留空表示任意邮箱都可注册。</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SMTP 主机</label>
                <input
                  type="text"
                  value={form.smtpHost}
                  onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                  placeholder="smtp.qq.com"
                  className="w-full px-4 py-3 rounded-xl bg-white/60 border border-white/50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">端口</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.smtpPort}
                  onChange={(e) => setForm({ ...form, smtpPort: e.target.value.replace(/[^0-9]/g, "") })}
                  placeholder="465"
                  className="w-full px-4 py-3 rounded-xl bg-white/60 border border-white/50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={form.smtpSecure}
                onChange={(e) => setForm({ ...form, smtpSecure: e.target.checked })}
                className="h-4 w-4 accent-blue-600"
              />
              <span className="text-sm text-gray-700">使用 SSL（端口 465 勾选；587 取消勾选走 STARTTLS）</span>
            </label>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SMTP 账号</label>
                <input
                  type="text"
                  value={form.smtpUser}
                  onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
                  placeholder="you@qq.com"
                  autoComplete="off"
                  className="w-full px-4 py-3 rounded-xl bg-white/60 border border-white/50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SMTP 密码 / 授权码</label>
                <input
                  type="password"
                  value={form.smtpPass}
                  onChange={(e) => setForm({ ...form, smtpPass: e.target.value })}
                  placeholder={smtpPassSet ? "已设置，留空则不修改" : "邮箱 SMTP 授权码"}
                  autoComplete="new-password"
                  className="w-full px-4 py-3 rounded-xl bg-white/60 border border-white/50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">发件人</label>
              <input
                type="text"
                value={form.smtpFrom}
                onChange={(e) => setForm({ ...form, smtpFrom: e.target.value })}
                placeholder="留空则用 SMTP 账号；也可写：智能海豹 <no-reply@x.com>"
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-white/50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTestSmtp}
                disabled={testing}
                className="rounded-xl border border-white/50 bg-white/70 px-5 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-white disabled:opacity-50"
              >
                {testing ? "发送中..." : "发送测试邮件"}
              </button>
              <span className="text-xs text-gray-400">请先「保存设置」，测试邮件会发到你的管理员邮箱</span>
            </div>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="flex items-center justify-end gap-4">
          {saved && <span className="text-sm font-medium text-green-600">✓ 已保存</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "保存中..." : "保存设置"}
          </button>
        </div>
      </div>
    </AdminLayout>
  )
}
