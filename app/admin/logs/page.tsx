"use client"

import { AdminLayout } from "@/components/admin/admin-layout"
import { useState, useEffect } from "react"

interface Log {
  id: string
  user: string
  action: string
  model: string
  tokens: number
  status: string
  message: string
  time: string
}

export default function AdminLogs() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')

  useEffect(() => {
    fetchLogs()
  }, [statusFilter, modelFilter])

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)
      if (modelFilter) params.append('model', modelFilter)

      const url = `/api/admin/logs${params.toString() ? '?' + params.toString() : ''}`
      const response = await fetch(url)
      const result = await response.json()

      if (result.success) {
        setLogs(result.data)
      }
    } catch (error) {
      console.error('获取日志失败:', error)
    } finally {
      setLoading(false)
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
        {/* 顶部筛选栏 */}
        <div className="rounded-2xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-lg p-6">
          <div className="flex gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 rounded-xl bg-white/60 border border-white/50 text-gray-700 text-sm"
            >
              <option value="">所有状态</option>
              <option value="success">成功</option>
              <option value="error">失败</option>
            </select>
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="px-4 py-2 rounded-xl bg-white/60 border border-white/50 text-gray-700 text-sm"
            >
              <option value="">所有模型</option>
              <option value="gpt-3.5-turbo">GPT-3.5</option>
              <option value="gpt-4">GPT-4</option>
              <option value="claude-3-sonnet">Claude</option>
            </select>
            <input
              type="date"
              className="px-4 py-2 rounded-xl bg-white/60 border border-white/50 text-gray-700 text-sm"
            />
          </div>
        </div>

        {/* 日志列表 */}
        <div className="rounded-2xl backdrop-blur-xl bg-white/70 border border-white/50 shadow-lg overflow-hidden">
          <div className="divide-y divide-white/30">
            {logs.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                暂无调用日志。在聊天中向已配置的 AI 提供商发送消息后，这里会显示真实的调用记录。
              </div>
            ) : (
              logs.map((log) => (
              <div key={log.id} className="p-6 hover:bg-white/40 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                        log.status === "success"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {log.status === "success" ? "成功" : "失败"}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{log.user}</span>
                  </div>
                  <span className="text-xs text-gray-500">{log.time}</span>
                </div>

                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">操作：</span>
                    <span className="text-gray-900 font-medium">{log.action}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">模型：</span>
                    <span className="text-gray-900 font-medium">{log.model}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Tokens：</span>
                    <span className="text-gray-900 font-medium">{log.tokens}</span>
                  </div>
                </div>

                <p className="mt-3 text-sm text-gray-700 bg-white/40 rounded-lg p-3">
                  {log.message}
                </p>
              </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
