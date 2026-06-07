"use client"

import { useState } from "react"
import { Menu, Plus, Search, X, Edit2, Trash2 } from "lucide-react"
import { useChatStore } from "@/lib/store"
import { formatDate } from "@/lib/utils"
import Link from "next/link"
import { useSiteName } from "@/components/site-name-provider"

export function ChatHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [editingId, setEditingId] = useState("")
  const [editingTitle, setEditingTitle] = useState("")
  const [deleteTargetId, setDeleteTargetId] = useState("")
  const siteName = useSiteName()

  const {
    user,
    conversations,
    activeConversationId,
    selectedModel,
    createConversation,
    setActiveConversation,
    renameConversation,
    removeConversation,
  } = useChatStore()

  const query = searchQuery.trim().toLowerCase()
  const filteredConversations = query
    ? conversations.filter((conv) =>
        conv.title.toLowerCase().includes(query)
      )
    : conversations

  const deleteTarget = conversations.find((c) => c.id === deleteTargetId)

  async function handleNewChat() {
    await createConversation("新对话", selectedModel)
    closeDrawer()
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setSearchOpen(false)
    setSearchQuery("")
    setEditingId("")
    setEditingTitle("")
  }

  function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId || !editingTitle.trim()) return
    renameConversation(editingId, editingTitle.trim())
    setEditingId("")
    setEditingTitle("")
  }

  function handleDelete() {
    if (!deleteTargetId) return
    removeConversation(deleteTargetId)
    setDeleteTargetId("")
  }

  return (
    <>
      {/* 顶部：仅菜单按钮，无标题 / 无分隔线，融入背景 */}
      <header
        className="flex items-center px-2 pb-2"
        style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-700 transition hover:bg-black/5"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* 侧边抽屉 */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* 遮罩层 */}
          <button
            onClick={closeDrawer}
            className="absolute inset-0 bg-black/40"
            aria-label="关闭菜单"
          />

          {/* 抽屉内容 */}
          <aside className="relative z-10 flex h-full w-[320px] flex-col bg-white shadow-2xl">
            {/* 头部 */}
            <header
              className="flex items-center justify-between border-b border-gray-200 px-4 pb-4"
              style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}
            >
              <h2 className="text-2xl font-bold">{siteName}</h2>
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100"
              >
                {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
              </button>
            </header>

            {/* 搜索框 */}
            {searchOpen && (
              <div className="border-b border-gray-200 p-4">
                <div className="flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2">
                  <Search className="h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索历史对话"
                    className="flex-1 bg-transparent text-sm outline-none"
                    autoFocus
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="text-xs text-gray-500">
                      清除
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 新建对话按钮 */}
            <button
              onClick={handleNewChat}
              className="mx-4 mt-4 flex items-center justify-center gap-2 rounded-xl bg-gray-100 py-3 font-semibold hover:bg-gray-200"
            >
              <Plus className="h-5 w-5" />
              新建对话
            </button>

            {/* 对话列表 */}
            <div className="flex-1 overflow-y-auto p-4">
              <p className="mb-2 text-xs text-gray-500">
                {query ? `搜索结果 ${filteredConversations.length}` : "历史对话"}
              </p>
              <div className="space-y-2">
                {filteredConversations.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">
                    {query ? "没有找到相关对话" : "暂无历史会话"}
                  </p>
                ) : (
                  filteredConversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`group rounded-xl border p-3 ${
                        activeConversationId === conv.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {editingId === conv.id ? (
                        <form onSubmit={handleRename} className="flex gap-2">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="flex-1 rounded-lg border border-gray-300 px-3 py-1 text-sm"
                            autoFocus
                          />
                          <button
                            type="submit"
                            className="rounded-lg bg-blue-500 px-3 py-1 text-sm text-white"
                          >
                            保存
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setActiveConversation(conv.id)
                              closeDrawer()
                            }}
                            className="w-full text-left"
                          >
                            <h3 className="font-medium">{conv.title}</h3>
                            <p className="mt-1 line-clamp-1 text-xs text-gray-500">
                              {conv.messages[conv.messages.length - 1]?.content || "暂无消息"}
                            </p>
                            <p className="mt-1 text-xs text-gray-400">{formatDate(conv.updatedAt)}</p>
                          </button>
                          <div className="mt-2 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => {
                                setEditingId(conv.id)
                                setEditingTitle(conv.title)
                              }}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-500"
                            >
                              <Edit2 className="h-3 w-3" />
                              重命名
                            </button>
                            <button
                              onClick={() => setDeleteTargetId(conv.id)}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500"
                            >
                              <Trash2 className="h-3 w-3" />
                              删除
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 底部用户信息 */}
            <Link
              href="/profile"
              onClick={closeDrawer}
              className="flex items-center gap-3 border-t border-gray-200 p-4 hover:bg-gray-50"
            >
              {user?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-lg font-bold text-white">
                  {user?.name?.[0]?.toUpperCase() || "U"}
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold">{user?.name || "游客"}</p>
                <p className="text-xs text-gray-500">{user?.email || "未登录"}</p>
              </div>
            </Link>
          </aside>
        </div>
      )}

      {/* 删除确认对话框 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold">删除这个对话？</h3>
            <p className="mt-2 text-sm text-gray-600">{deleteTarget.title}</p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteTargetId("")}
                className="flex-1 rounded-xl bg-gray-100 py-2 font-medium hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded-xl bg-red-500 py-2 font-medium text-white hover:bg-red-600"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
