"use client"

import { AdminLayout } from "@/components/admin/admin-layout"
import { useState, useEffect } from "react"
import { Plus, Check, X, Zap, Save, Trash2 } from "lucide-react"

interface Provider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  hasApiKey?: boolean
  enabled: boolean
  models: Array<{ id: string; code: string; name: string; price: number }>
  requests: number
  lastTest?: string
}

interface ProviderFormData {
  name: string
  baseUrl: string
  apiKey: string
  enabled: boolean
}

export default function AdminProviders() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
  const [formData, setFormData] = useState<ProviderFormData>({
    name: '',
    baseUrl: '',
    apiKey: '',
    enabled: true,
  })
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  // 测试连接：先拉取该提供商的可用模型，选一个再测（不再写死模型）
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [testModel, setTestModel] = useState("")
  const [loadingModels, setLoadingModels] = useState(false)

  // 模型管理
  const [modelProvider, setModelProvider] = useState<Provider | null>(null)
  const [importing, setImporting] = useState(false)
  const [newModelCode, setNewModelCode] = useState("")
  const [newModelName, setNewModelName] = useState("")
  const [newModelPrice, setNewModelPrice] = useState("1")
  const [modelMsg, setModelMsg] = useState<string | null>(null)

  useEffect(() => {
    fetchProviders()
  }, [])

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/admin/providers')
      const result = await response.json()

      if (result.success) {
        setProviders(result.data)
      }
    } catch (error) {
      console.error('获取提供商列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingProvider(null)
    setFormData({
      name: '',
      baseUrl: '',
      apiKey: '',
      enabled: true,
    })
    setTestResult(null)
    setAvailableModels([])
    setTestModel("")
    setShowModal(true)
  }

  const handleEdit = (provider: Provider) => {
    setEditingProvider(provider)
    setFormData({
      name: provider.name,
      baseUrl: provider.baseUrl,
      apiKey: "", // 不回填（key 已打码）；留空提交则保持原 key 不变
      enabled: provider.enabled,
    })
    setTestResult(null)
    // 已配置的模型先填入选择器；也可点「获取模型」从提供商实时拉取
    const codes = provider.models?.map((m) => m.code) ?? []
    setAvailableModels(codes)
    setTestModel(codes[0] ?? "")
    setShowModal(true)
  }

  // 「获取模型」：已保存的提供商直接拉取并入库（解决「获取到了却没加进去」），
  // 同时回填测试选择器；新建尚未保存的提供商只列出供测试，保存时会自动导入。
  const handleFetchModels = async () => {
    setLoadingModels(true)
    setTestResult(null)
    try {
      if (editingProvider?.id) {
        const response = await fetch(`/api/admin/providers/${editingProvider.id}/models/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: formData.apiKey || undefined,
            baseUrl: formData.baseUrl || undefined,
          }),
        })
        const result = await response.json()
        if (result.success && Array.isArray(result.models) && result.models.length > 0) {
          setAvailableModels(result.models)
          setTestModel(result.models[0])
          setTestResult({ success: true, message: `获取到 ${result.models.length} 个模型并已加入模型列表` })
          await fetchProviders() // 刷新卡片上的模型数量/标签
        } else {
          setTestResult({ success: false, message: result.error || result.message || '未获取到模型列表' })
        }
      } else {
        const response = await fetch('/api/admin/providers/list-models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: formData.apiKey || undefined,
            baseUrl: formData.baseUrl,
          }),
        })
        const result = await response.json()
        if (result.success && Array.isArray(result.models) && result.models.length > 0) {
          setAvailableModels(result.models)
          setTestModel(result.models[0])
          setTestResult({ success: true, message: `获取到 ${result.models.length} 个模型，保存提供商后将自动加入模型列表` })
        } else {
          setTestResult({ success: false, message: result.message || '未获取到模型列表' })
        }
      }
    } catch (error) {
      setTestResult({ success: false, message: '获取模型失败: ' + error })
    } finally {
      setLoadingModels(false)
    }
  }

  const handleTest = async (provider?: Provider) => {
    setTesting(true)
    setTestResult(null)

    const target = provider ?? editingProvider
    // 列表内快速测试用该提供商首个已配置模型；弹窗内用选择器选中的模型；
    // 都没有时交给服务端自动探测（不再写死未知模型）
    const model = provider ? provider.models?.[0]?.code : (testModel || availableModels[0])
    try {
      const response = await fetch('/api/admin/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: target?.id,
          // 列表内测试用存储的 key；弹窗内若填了新 key 则用新 key，否则回退到存储 key
          apiKey: provider ? undefined : (formData.apiKey || undefined),
          baseUrl: provider ? provider.baseUrl : formData.baseUrl,
          model: model || undefined,
        }),
      })

      const result = await response.json()
      // 列表内测试无内联展示区，用弹窗反馈；弹窗内测试就地展示
      if (provider) alert(result.message)
      else setTestResult(result)
    } catch (error) {
      const msg = '测试失败: ' + error
      if (provider) alert(msg)
      else setTestResult({ success: false, message: msg })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)

    try {
      const url = editingProvider
        ? `/api/admin/providers/${editingProvider.id}`
        : '/api/admin/providers'

      const method = editingProvider ? 'PATCH' : 'POST'

      // 编辑时留空的 apiKey 不提交（后端按「保持原 key」处理）
      const payload = editingProvider
        ? {
            name: formData.name,
            baseUrl: formData.baseUrl,
            enabled: formData.enabled,
            ...(formData.apiKey.trim() ? { apiKey: formData.apiKey.trim() } : {}),
          }
        : formData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (result.success) {
        // 新建提供商：自动从其 /models 导入可用模型，省去再去「管理模型」手动导入。
        // 导入失败（如 key 无效）不阻断保存，可稍后在「管理模型」重试。
        if (!editingProvider && result.data?.id) {
          try {
            await fetch(`/api/admin/providers/${result.data.id}/models/import`, { method: 'POST' })
          } catch {
            /* 忽略：保存已成功，模型可稍后导入 */
          }
        }
        setShowModal(false)
        fetchProviders()
      } else {
        alert('保存失败: ' + result.error)
      }
    } catch (error) {
      alert('保存失败: ' + error)
    } finally {
      setSaving(false)
    }
  }

  const openModelManager = (provider: Provider) => {
    setModelProvider(provider)
    setNewModelCode("")
    setNewModelName("")
    setNewModelPrice("1")
    setModelMsg(null)
  }

  // 重新拉取列表后，同步刷新正在管理的提供商的模型
  const refreshModelProvider = async (providerId: string) => {
    const response = await fetch('/api/admin/providers')
    const result = await response.json()
    if (result.success) {
      setProviders(result.data)
      const updated = result.data.find((p: Provider) => p.id === providerId)
      if (updated) setModelProvider(updated)
    }
  }

  const handleImportModels = async () => {
    if (!modelProvider) return
    setImporting(true)
    setModelMsg(null)
    try {
      const response = await fetch(`/api/admin/providers/${modelProvider.id}/models/import`, {
        method: 'POST',
      })
      const result = await response.json()
      setModelMsg(result.success ? result.message : `导入失败: ${result.error}`)
      if (result.success) await refreshModelProvider(modelProvider.id)
    } catch (error) {
      setModelMsg('导入失败: ' + error)
    } finally {
      setImporting(false)
    }
  }

  const handleAddModel = async () => {
    if (!modelProvider || !newModelCode.trim()) return
    setModelMsg(null)
    try {
      const response = await fetch(`/api/admin/providers/${modelProvider.id}/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newModelCode.trim(), name: newModelName.trim() || newModelCode.trim(), price: parseFloat(newModelPrice) || 1 }),
      })
      const result = await response.json()
      if (result.success) {
        setNewModelCode("")
        setNewModelName("")
        setNewModelPrice("1")
        await refreshModelProvider(modelProvider.id)
      } else {
        setModelMsg('添加失败: ' + result.error)
      }
    } catch (error) {
      setModelMsg('添加失败: ' + error)
    }
  }

  const handleUpdateModelPrice = async (modelId: string, price: number) => {
    if (!modelProvider || isNaN(price) || price < 0) return
    try {
      const response = await fetch(`/api/admin/models/${modelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price }),
      })
      const result = await response.json()
      if (result.success) await refreshModelProvider(modelProvider.id)
      else setModelMsg('价格更新失败: ' + result.error)
    } catch (error) {
      setModelMsg('价格更新失败: ' + error)
    }
  }

  const handleDeleteModel = async (modelId: string) => {
    if (!modelProvider) return
    try {
      const response = await fetch(`/api/admin/models/${modelId}`, { method: 'DELETE' })
      const result = await response.json()
      if (result.success) await refreshModelProvider(modelProvider.id)
    } catch (error) {
      console.error('删除模型失败:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个提供商吗？')) return

    try {
      const response = await fetch(`/api/admin/providers/${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        fetchProviders()
      } else {
        alert('删除失败: ' + result.error)
      }
    } catch (error) {
      alert('删除失败: ' + error)
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
        {/* 顶部操作栏 */}
        <div className="rounded-2xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI 接口管理</h2>
              <p className="text-sm text-gray-500 mt-1">配置和管理 AI 服务提供商</p>
            </div>
            <button
              onClick={handleAdd}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium transition-all flex items-center gap-2 shadow-lg shadow-blue-500/30 hover:shadow-xl"
            >
              <Plus className="w-4 h-4" />
              添加接口
            </button>
          </div>
        </div>

        {/* 接口列表 */}
        <div className="space-y-4">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="rounded-2xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-lg hover:shadow-xl transition-all"
            >
              <div className="p-6">
                {/* 头部 */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{provider.name}</h3>
                      <p className="text-sm text-gray-500">{provider.baseUrl}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {provider.enabled ? (
                      <span className="px-3 py-1 rounded-lg bg-green-100 text-green-700 text-xs font-semibold flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        运行中
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                        已停用
                      </span>
                    )}
                  </div>
                </div>

                {/* 详细信息 */}
                <div className="grid grid-cols-4 gap-6 mb-6">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">API Key</p>
                    <p className="text-sm font-mono text-gray-900">{provider.apiKey}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">可用模型</p>
                    <p className="text-sm font-semibold text-gray-900">{provider.models?.length || 0} 个</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">调用次数</p>
                    <p className="text-sm font-semibold text-gray-900">{provider.requests.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">最后测试</p>
                    <p className="text-sm font-medium text-gray-900">{provider.lastTest}</p>
                  </div>
                </div>

                {/* 模型标签 */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {provider.models.map((model) => (
                    <span
                      key={model.id}
                      className="px-3 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-medium"
                    >
                      {model.name}
                    </span>
                  ))}
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTest(provider)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white text-sm font-medium transition-all shadow-md shadow-green-500/30"
                  >
                    测试连接
                  </button>
                  <button
                    onClick={() => handleEdit(provider)}
                    className="px-4 py-2 rounded-xl bg-white/60 hover:bg-white/80 text-gray-700 text-sm font-medium transition-all"
                  >
                    编辑配置
                  </button>
                  <button
                    onClick={() => openModelManager(provider)}
                    className="px-4 py-2 rounded-xl bg-white/60 hover:bg-white/80 text-gray-700 text-sm font-medium transition-all"
                  >
                    管理模型
                  </button>
                  <button
                    onClick={() => handleDelete(provider.id)}
                    className="ml-auto px-4 py-2 rounded-xl bg-white/60 hover:bg-red-100 text-gray-700 hover:text-red-600 text-sm font-medium transition-all flex items-center gap-2"
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
                {editingProvider ? '编辑 AI 提供商' : '添加 AI 提供商'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  提供商名称 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如: OpenAI, Claude, 自定义"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                />
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Base URL *
                </label>
                <input
                  type="url"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                />
                <p className="text-xs text-gray-500 mt-2">
                  常用:
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, baseUrl: 'https://api.openai.com/v1' })}
                    className="ml-2 text-blue-600 hover:underline"
                  >
                    OpenAI
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, baseUrl: 'https://api.anthropic.com/v1' })}
                    className="ml-2 text-blue-600 hover:underline"
                  >
                    Claude
                  </button>
                </p>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key {editingProvider ? "" : "*"}
                </label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder={editingProvider?.hasApiKey ? "留空则保持原 Key 不变" : "sk-..."}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-mono text-sm"
                />
                {editingProvider?.hasApiKey && (
                  <p className="text-xs text-gray-500 mt-2">
                    当前已配置：<span className="font-mono">{editingProvider.apiKey}</span>，留空保存则保持不变
                  </p>
                )}
              </div>

              {/* 测试模型：先获取再选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  测试模型
                </label>
                <div className="flex gap-2">
                  <select
                    value={testModel}
                    onChange={(e) => setTestModel(e.target.value)}
                    disabled={availableModels.length === 0}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    {availableModels.length === 0 ? (
                      <option value="">请先点「获取模型」</option>
                    ) : (
                      availableModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={handleFetchModels}
                    disabled={loadingModels || !formData.baseUrl || (!formData.apiKey && !editingProvider?.hasApiKey)}
                    className="shrink-0 px-4 py-3 rounded-xl bg-white border border-gray-300 hover:bg-gray-50 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingModels ? '获取中...' : '获取模型'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  从该提供商拉取可用模型：已保存的提供商会同时加入其模型列表；选择一个可用于「测试连接」
                </p>
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
                  启用此提供商
                </label>
              </div>

              {/* 测试结果 */}
              {testResult && (
                <div
                  className={`p-4 rounded-xl ${
                    testResult.success
                      ? 'bg-green-50 border border-green-200 text-green-700'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}
                >
                  <p className="text-sm font-medium">{testResult.message}</p>
                  {testResult.success && (
                    <p className="text-xs mt-1 opacity-80">API 连接正常，可以保存配置</p>
                  )}
                </div>
              )}
            </div>

            {/* 底部操作栏 */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3">
              <button
                onClick={() => handleTest()}
                disabled={testing || !formData.baseUrl || (!formData.apiKey && !editingProvider?.hasApiKey)}
                className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {testing ? '测试中...' : '测试连接'}
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name || !formData.baseUrl || saving || (!editingProvider && !formData.apiKey)}
                className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? '保存中...' : '保存配置'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 模型管理弹窗 */}
      {modelProvider && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">模型管理</h2>
                <p className="text-sm text-gray-500">{modelProvider.name}</p>
              </div>
              <button
                onClick={() => setModelProvider(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 一键导入 */}
              <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-blue-50 border border-blue-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">从提供商导入模型</p>
                  <p className="text-xs text-gray-500 mt-1">
                    调用 <code>{modelProvider.baseUrl}/models</code> 自动获取可用模型
                  </p>
                </div>
                <button
                  onClick={handleImportModels}
                  disabled={importing}
                  className="shrink-0 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white text-sm font-medium transition-all disabled:opacity-50"
                >
                  {importing ? '导入中...' : '一键导入'}
                </button>
              </div>

              {/* 手动添加 */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">手动添加模型</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newModelCode}
                    onChange={(e) => setNewModelCode(e.target.value)}
                    placeholder="模型代码 (如 gpt-4o-mini)"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-mono"
                  />
                  <input
                    type="text"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    placeholder="显示名称 (可选)"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={newModelPrice}
                    onChange={(e) => setNewModelPrice(e.target.value)}
                    title="额度单价（每 token 扣多少额度，1 = 标准）"
                    placeholder="价格"
                    className="w-20 px-3 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm text-right"
                  />
                  <button
                    onClick={handleAddModel}
                    disabled={!newModelCode.trim()}
                    className="shrink-0 px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium transition-all disabled:opacity-50"
                  >
                    添加
                  </button>
                </div>
              </div>

              {modelMsg && (
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-2">{modelMsg}</p>
              )}

              {/* 已有模型列表 */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  已配置模型（{modelProvider.models?.length || 0}）
                </p>
                {!modelProvider.models || modelProvider.models.length === 0 ? (
                  <p className="text-sm text-gray-400 py-6 text-center bg-gray-50 rounded-xl">
                    暂无模型，请导入或手动添加
                  </p>
                ) : (
                  <div className="space-y-2">
                    {modelProvider.models.map((model) => (
                      <div
                        key={model.id}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-gray-200"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{model.name}</p>
                          <p className="text-xs text-gray-500 font-mono truncate">{model.code}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            defaultValue={model.price}
                            onBlur={(e) => handleUpdateModelPrice(model.id, parseFloat(e.target.value))}
                            title="额度单价（每 token 扣多少额度，1 = 标准）"
                            className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-right text-sm outline-none focus:border-blue-500"
                          />
                          <span className="text-xs text-gray-400">额度/token</span>
                        </div>
                        <button
                          onClick={() => handleDeleteModel(model.id)}
                          className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
