"use client"

import { AdminLayout } from "@/components/admin/admin-layout"
import { useEffect, useState } from "react"
import { downscaleImageToDataUrl } from "@/lib/image"

interface SettingsForm {
  siteName: string
  logoUrl: string
  description: string
  announcement: string
  registrationMode: string
  defaultPlanId: string
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
  })
  const [plans, setPlans] = useState<PlanOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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
          })
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
