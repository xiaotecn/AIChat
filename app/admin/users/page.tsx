"use client"

import { AdminLayout } from "@/components/admin/admin-layout"
import { useState, useEffect } from "react"
import { Search, Plus, Edit, Trash2, MoreVertical, Save, X, RotateCcw, Crown } from "lucide-react"

// 把 ISO 时间转成 <input type="datetime-local"> 需要的本地 "YYYY-MM-DDTHH:mm"
function fmtLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 列表里的到期展示：永久 / 至 X / 已过期 X
function expiryLabel(expiresAt: string | null): { text: string; cls: string } {
  if (!expiresAt) return { text: "永久", cls: "text-gray-400" }
  const exp = new Date(expiresAt)
  const past = exp.getTime() < Date.now()
  return {
    text: (past ? "已过期 " : "至 ") + exp.toLocaleDateString(),
    cls: past ? "text-red-600 font-medium" : "text-gray-500",
  }
}

interface User {
  id: string
  name: string
  email: string
  role: string
  planId: string | null
  usedTokens: number
  usedMessages: number
  usedImages: number
  tokenLimit: number
  messageLimit: number
  imageLimit: number
  status: string
  expiresAt: string | null
  subscriptionStatus: string
  createdAt: string
}

interface Plan {
  id: string
  name: string
}

interface UserFormData {
  name: string
  email: string
  password?: string
  role: string
  status: string
}

export default function AdminUsers() {
  const [searchQuery, setSearchQuery] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    password: '',
    role: 'user',
    status: 'active',
  })

  // 订阅管理弹窗（与「编辑用户」分离）：null = 关闭
  const [subUser, setSubUser] = useState<User | null>(null)
  const [subPlanId, setSubPlanId] = useState('')
  const [subExpiresAt, setSubExpiresAt] = useState('') // datetime-local；空 = 永久不过期
  const [subSaving, setSubSaving] = useState(false)

  useEffect(() => {
    fetchUsers()
    fetchPlans()
  }, [searchQuery])

  const fetchUsers = async () => {
    try {
      const url = searchQuery
        ? `/api/admin/users?search=${encodeURIComponent(searchQuery)}`
        : '/api/admin/users'

      const response = await fetch(url)
      const result = await response.json()

      if (result.success) {
        setUsers(result.data)
      }
    } catch (error) {
      console.error('获取用户列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/admin/plans')
      const result = await response.json()
      if (result.success) {
        setPlans(result.data)
      }
    } catch (error) {
      console.error('获取套餐列表失败:', error)
    }
  }

  const handleAdd = () => {
    setEditingUser(null)
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'user',
      status: 'active',
    })
    setShowModal(true)
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      status: user.status,
    })
    setShowModal(true)
  }

  // 打开订阅管理弹窗：预填当前套餐与到期时间
  const handleOpenSub = (user: User) => {
    setSubUser(user)
    setSubPlanId(user.planId || plans[0]?.id || '')
    setSubExpiresAt(user.expiresAt ? fmtLocalInput(new Date(user.expiresAt)) : '')
  }

  // 订阅弹窗内：把到期时间快捷设为「当前 + N 天」
  const subSetDuration = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    setSubExpiresAt(fmtLocalInput(d))
  }

  // 开通 / 变更订阅
  const subActivate = async () => {
    if (!subUser) return
    if (!subPlanId) {
      alert('请先选择套餐')
      return
    }
    setSubSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${subUser.id}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate', planId: subPlanId, expiresAt: subExpiresAt || null }),
      })
      const result = await res.json()
      if (result.success) {
        setSubUser(null)
        fetchUsers()
      } else {
        alert('开通失败: ' + result.error)
      }
    } catch (error) {
      alert('开通失败: ' + error)
    } finally {
      setSubSaving(false)
    }
  }

  // 加时间：在当前到期时间基础上叠加 N 天（不重置用量）
  const subExtend = async (days: number) => {
    if (!subUser) return
    setSubSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${subUser.id}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extend', days }),
      })
      const result = await res.json()
      if (result.success) {
        // 同步弹窗内展示与列表（不关闭弹窗，便于连续加时间）
        setSubUser((prev) => (prev ? { ...prev, ...result.data } : prev))
        setSubExpiresAt(result.data.expiresAt ? fmtLocalInput(new Date(result.data.expiresAt)) : '')
        fetchUsers()
      } else {
        alert('加时间失败: ' + result.error)
      }
    } catch (error) {
      alert('加时间失败: ' + error)
    } finally {
      setSubSaving(false)
    }
  }

  // 取消订阅：回退到系统默认套餐并清空到期时间
  const subCancel = async () => {
    if (!subUser) return
    if (!confirm(`确定取消「${subUser.name}」的订阅吗？将回退到默认套餐并清空到期时间。`)) return
    setSubSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${subUser.id}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      const result = await res.json()
      if (result.success) {
        setSubUser(null)
        fetchUsers()
      } else {
        alert('取消失败: ' + result.error)
      }
    } catch (error) {
      alert('取消失败: ' + error)
    } finally {
      setSubSaving(false)
    }
  }

  const handleResetUsage = async (user: User) => {
    if (!confirm(`确定要重置「${user.name}」当前订阅周期的额度吗？已用 token / 消息 / 图片将清零。`)) return
    try {
      const response = await fetch(`/api/admin/users/${user.id}/reset-usage`, { method: 'POST' })
      const result = await response.json()
      if (result.success) {
        fetchUsers()
      } else {
        alert('重置失败: ' + result.error)
      }
    } catch (error) {
      alert('重置失败: ' + error)
    }
  }

  const handleSave = async () => {
    setSaving(true)

    try {
      const url = editingUser
        ? `/api/admin/users/${editingUser.id}`
        : '/api/admin/users'

      const method = editingUser ? 'PATCH' : 'POST'

      // 如果是编辑且没有输入新密码，不发送密码字段
      const dataToSend = editingUser && !formData.password
        ? { ...formData, password: undefined }
        : formData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      })

      const result = await response.json()

      if (result.success) {
        setShowModal(false)
        fetchUsers()
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
    if (!confirm('确定要删除此用户吗？')) return

    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      })
      const result = await response.json()

      if (result.success) {
        fetchUsers()
      }
    } catch (error) {
      console.error('删除用户失败:', error)
    }
  }

  const getPlanName = (planId: string | null) => {
    if (!planId) return '未分配'
    const plan = plans.find(p => p.id === planId)
    return plan?.name || planId
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* 顶部操作栏 */}
        <div className="rounded-2xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-lg p-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索用户名、邮箱..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/60 border border-white/50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white/80 transition-all"
              />
            </div>

            <div className="flex gap-3">
              <button className="px-4 py-3 rounded-xl bg-white/60 hover:bg-white/80 text-gray-700 font-medium transition-all flex items-center gap-2 shadow-sm hover:shadow">
                <MoreVertical className="w-4 h-4" />
                筛选
              </button>
              <button
                onClick={handleAdd}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium transition-all flex items-center gap-2 shadow-lg shadow-blue-500/30 hover:shadow-xl"
              >
                <Plus className="w-4 h-4" />
                新建用户
              </button>
            </div>
          </div>
        </div>

        {/* 用户列表 */}
        <div className="rounded-2xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/50 border-b border-white/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">用户</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">套餐</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">角色</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">使用量</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/30">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-white/30 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="w-fit px-3 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-semibold">
                          {getPlanName(user.planId)}
                        </span>
                        <span className={`text-xs ${expiryLabel(user.expiresAt).cls}`}>
                          {expiryLabel(user.expiresAt).text}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {user.role === 'admin' ? '管理员' : '用户'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                              style={{
                                width: `${
                                  user.messageLimit < 0
                                    ? 100
                                    : user.messageLimit > 0
                                    ? Math.min((user.usedMessages / user.messageLimit) * 100, 100)
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 whitespace-nowrap">
                            消息 {user.usedMessages.toLocaleString()} / {user.messageLimit < 0 ? "不限" : user.messageLimit.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 whitespace-nowrap">
                          图片 {user.usedImages.toLocaleString()} / {user.imageLimit < 0 ? "不限" : user.imageLimit.toLocaleString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {user.status === 'active' ? '正常' : '禁用'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenSub(user)}
                          className="p-2 hover:bg-violet-100 rounded-lg transition-colors"
                          title="订阅管理"
                        >
                          <Crown className="w-4 h-4 text-violet-600" />
                        </button>
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 hover:bg-white/60 rounded-lg transition-colors"
                          title="编辑"
                        >
                          <Edit className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleResetUsage(user)}
                          className="p-2 hover:bg-amber-100 rounded-lg transition-colors"
                          title="重置额度"
                        >
                          <RotateCcw className="w-4 h-4 text-amber-600" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 添加/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingUser ? '编辑用户' : '新建用户'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 姓名 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  姓名 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="请输入姓名"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                />
              </div>

              {/* 邮箱 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  邮箱 *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                />
              </div>

              {/* 密码 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  密码 {editingUser ? '(留空不修改)' : '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? "留空则不修改密码" : "请输入密码"}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                />
              </div>

              {/* 角色 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  角色 *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                >
                  <option value="user">用户</option>
                  <option value="admin">管理员</option>
                </select>
              </div>

              {/* 套餐与到期时间已移至独立的「订阅管理」入口（用户行的皇冠按钮） */}

              {/* 状态 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  状态 *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                >
                  <option value="active">正常</option>
                  <option value="inactive">禁用</option>
                </select>
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
                disabled={!formData.name || !formData.email || (!editingUser && !formData.password) || saving}
                className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 订阅管理弹窗（与编辑用户分离：开通/变更、加时间、取消） */}
      {subUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Crown className="w-5 h-5 text-violet-600" />
                订阅管理
              </h2>
              <button
                onClick={() => setSubUser(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 当前订阅状态 */}
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                <div className="text-sm text-gray-500 mb-2">
                  {subUser.name} · {subUser.email}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-semibold">
                    {getPlanName(subUser.planId)}
                  </span>
                  <span className={`text-xs ${expiryLabel(subUser.expiresAt).cls}`}>
                    {expiryLabel(subUser.expiresAt).text}
                  </span>
                </div>
              </div>

              {/* 开通 / 变更订阅 */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">开通 / 变更订阅</h3>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">套餐</label>
                  <select
                    value={subPlanId}
                    onChange={(e) => setSubPlanId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all"
                  >
                    <option value="">请选择套餐</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>{plan.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">到期时间（留空 = 永久不过期）</label>
                  <div className="flex gap-2">
                    <input
                      type="datetime-local"
                      value={subExpiresAt}
                      onChange={(e) => setSubExpiresAt(e.target.value)}
                      className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all"
                    />
                    {subExpiresAt && (
                      <button
                        type="button"
                        onClick={() => setSubExpiresAt('')}
                        className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm whitespace-nowrap"
                      >
                        永久
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      { label: '30 天', days: 30 },
                      { label: '90 天', days: 90 },
                      { label: '180 天', days: 180 },
                      { label: '1 年', days: 365 },
                    ].map((q) => (
                      <button
                        key={q.days}
                        type="button"
                        onClick={() => subSetDuration(q.days)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-violet-50 hover:border-violet-300 transition-all"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={subActivate}
                  disabled={subSaving || !subPlanId}
                  className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {subSaving ? '处理中...' : '开通 / 更新订阅'}
                </button>
              </div>

              {/* 加时间（仅当前已有到期时间时可叠加） */}
              {subUser.expiresAt && (
                <div className="space-y-2 border-t border-gray-100 pt-5">
                  <h3 className="text-sm font-semibold text-gray-700">加时间（在当前到期基础上叠加）</h3>
                  <div className="flex flex-wrap gap-2">
                    {[7, 30, 90, 180, 365].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => subExtend(d)}
                        disabled={subSaving}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-green-50 hover:border-green-300 transition-all disabled:opacity-50"
                      >
                        +{d} 天
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 取消订阅 */}
              <div className="border-t border-gray-100 pt-5">
                <button
                  onClick={subCancel}
                  disabled={subSaving}
                  className="w-full px-6 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-medium transition-all disabled:opacity-50"
                >
                  取消订阅（回退默认套餐）
                </button>
                <p className="text-xs text-gray-400 mt-2">
                  取消后该用户回退到系统设置里的「默认套餐」，到期时间清空、当前用量周期重置。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
