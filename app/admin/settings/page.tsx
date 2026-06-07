"use client"

import { AdminLayout } from "@/components/admin/admin-layout"
import { useEffect, useState } from "react"

interface SettingsForm {
  siteName: string
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
