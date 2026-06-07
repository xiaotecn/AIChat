"use client"

import { AdminLayout } from "@/components/admin/admin-layout"
import { useState, useEffect } from "react"
import { Plus, Edit, Trash2, Check, Save, X } from "lucide-react"

interface Plan {
  id: string
  name: string
  description: string | null
  tokenLimit: number
  messageLimit: number
  imageLimit: number
  price: number
  resetCycle: string
  enabled: boolean
  users: number
  groupIds: string[]
}

interface GroupOption {
  id: string
  name: string
}

interface PlanFormData {
  name: string
  description: string
  tokenLimit: number
  messageLimit: number
  imageLimit: number
  price: number
  resetCycle: string
  enabled: boolean
  groupIds: string[]
}

export default function AdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<PlanFormData>({
    name: '',
    description: '',
    tokenLimit: 100000,
    messageLimit: 100,
    imageLimit: 50,
    price: 0,
    resetCycle: 'monthly',
    enabled: true,
    groupIds: [],
  })

  useEffect(() => {
    fetchPlans()
    fetchGroups()
  }, [])

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/admin/plans')
      const result = await response.json()

      if (result.success) {
        setPlans(result.data)
      }
    } catch (error) {
      console.error('获取套餐列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/admin/model-groups')
      const result = await response.json()
      if (result.success && Array.isArray(result.data)) {
        setGroups(result.data.map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })))
      }
    } catch (error) {
      console.error('获取分组列表失败:', error)
    }
  }

  const handleAdd = () => {
    setEditingPlan(null)
    setFormData({
      name: '',
      description: '',
      tokenLimit: 100000,
      messageLimit: 100,
      imageLimit: 50,
      price: 0,
      resetCycle: 'monthly',
      enabled: true,
      groupIds: [],
    })
    setShowModal(true)
  }

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan)
    setFormData({
      name: plan.name,
      description: plan.description || '',
      tokenLimit: plan.tokenLimit,
      messageLimit: plan.messageLimit,
      imageLimit: plan.imageLimit,
      price: plan.price,
      resetCycle: plan.resetCycle,
      enabled: plan.enabled,
      groupIds: plan.groupIds || [],
    })
    setShowModal(true)
  }

  const toggleGroup = (groupId: string) => {
    setFormData((prev) => ({
      ...prev,
      groupIds: prev.groupIds.includes(groupId)
        ? prev.groupIds.filter((id) => id !== groupId)
        : [...prev.groupIds, groupId],
    }))
  }

  const handleSave = async () => {
    setSaving(true)

    try {
      const url = editingPlan
        ? `/api/admin/plans/${editingPlan.id}`
        : '/api/admin/plans'

      const method = editingPlan ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (result.success) {
        setShowModal(false)
        fetchPlans()
      } else {
        alert('保存失败: ' + result.error)
      }
    } catch (error) {
      alert('保存失败: ' + error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此套餐吗？')) return

    try {
      const response = await fetch(`/api/admin/plans/${id}`, {
        method: 'DELETE',
      })
      const result = await response.json()

      if (result.success) {
        fetchPlans()
      }
    } catch (error) {
      console.error('删除套餐失败:', error)
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
        <div className="rounded-2xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">套餐管理</h2>
              <p className="text-sm text-gray-500 mt-1">管理订阅套餐和定价策略</p>
            </div>
            <button
              onClick={handleAdd}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium transition-all flex items-center gap-2 shadow-lg shadow-blue-500/30 hover:shadow-xl"
            >
              <Plus className="w-4 h-4" />
              新建套餐
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-2xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-lg hover:shadow-xl transition-all overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                    {plan.description && (
                      <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                    )}
                  </div>
                  {plan.enabled ? (
                    <span className="px-3 py-1 rounded-lg bg-green-100 text-green-700 text-xs font-semibold">
                      启用
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold">
                      禁用
                    </span>
                  )}
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-gray-900">
                      ¥{plan.price.toFixed(2)}
                    </span>
                    <span className="text-gray-500">
                      /{plan.resetCycle === 'monthly' ? '月' : plan.resetCycle === 'daily' ? '天' : '年'}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500" />
                    {plan.tokenLimit.toLocaleString()} Token 额度
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500" />
                    {plan.messageLimit.toLocaleString()} 条消息
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500" />
                    {plan.imageLimit < 0 ? "不限图片生成" : `${plan.imageLimit.toLocaleString()} 张图片`}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500" />
                    {plan.users} 个用户使用
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-white/50">
                  <button
                    onClick={() => handleEdit(plan)}
                    className="flex-1 px-4 py-2 rounded-xl bg-white/60 hover:bg-white/80 text-gray-700 font-medium transition-all flex items-center justify-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(plan.id)}
                    className="flex-1 px-4 py-2 rounded-xl bg-white/60 hover:bg-red-100 text-gray-700 hover:text-red-600 font-medium transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 添加/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingPlan ? '编辑套餐' : '新建套餐'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 套餐名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  套餐名称 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如: 免费版、专业版"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                />
              </div>

              {/* 描述 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="套餐描述..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                />
              </div>

              {/* Token 限额 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Token 限额 *
                </label>
                <input
                  type="number"
                  value={formData.tokenLimit}
                  onChange={(e) => setFormData({ ...formData, tokenLimit: parseInt(e.target.value) || 0 })}
                  placeholder="100000"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                />
              </div>

              {/* 消息限额 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  消息限额 *
                </label>
                <input
                  type="number"
                  value={formData.messageLimit}
                  onChange={(e) => setFormData({ ...formData, messageLimit: parseInt(e.target.value) || 0 })}
                  placeholder="100"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                />
              </div>

              {/* 图片生成限额 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  图片生成限额 *
                </label>
                <input
                  type="number"
                  value={formData.imageLimit}
                  onChange={(e) => {
                    const n = parseInt(e.target.value)
                    setFormData({ ...formData, imageLimit: Number.isNaN(n) ? -1 : n })
                  }}
                  placeholder="50"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                />
                <p className="text-xs text-gray-400 mt-1">每个周期可生成的图片张数。-1 = 不限，0 = 禁止生成。</p>
              </div>

              {/* 价格 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  价格 (元) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                />
              </div>

              {/* 重置周期 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  重置周期 *
                </label>
                <select
                  value={formData.resetCycle}
                  onChange={(e) => setFormData({ ...formData, resetCycle: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                >
                  <option value="daily">每日</option>
                  <option value="monthly">每月</option>
                  <option value="yearly">每年</option>
                </select>
              </div>

              {/* 启用状态 */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300"
                />
                <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
                  启用此套餐
                </label>
              </div>

              {/* 可用模型分组 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  可用模型分组
                </label>
                {groups.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    暂无分组，请先到「模型分组」创建。
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto rounded-xl border border-gray-200 p-3">
                    {groups.map((g) => (
                      <label
                        key={g.id}
                        className="flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1.5 hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={formData.groupIds.includes(g.id)}
                          onChange={() => toggleGroup(g.id)}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{g.name}</span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  订阅此套餐的用户在聊天页可选择这些分组。
                </p>
              </div>
            </div>

            {/* 底部操作栏 */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-6 py-3 rounded-xl bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium transition-all"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name || saving}
                className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
