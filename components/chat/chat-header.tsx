"use client"

import { useState } from "react"
import { Plus, Search, X, Edit2, Trash2, MoreVertical } from "lucide-react"
import { useChatStore } from "@/lib/store"
import Link from "next/link"
import { useSiteName } from "@/components/site-name-provider"

export function ChatHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [editingId, setEditingId] = useState("")
  const [editingTitle, setEditingTitle] = useState("")
  const [deleteTargetId, setDeleteTargetId] = useState("")
  const [menuOpenId, setMenuOpenId] = useState("")
  const siteName = useSiteName()

  const {
    user,
    conversations,
    activeConversationId,
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

  // 当前对话是否为空（无消息且无预览）→ 已是「新对话」状态，禁止重复新建
  const activeConv = conversations.find((c) => c.id === activeConversationId)
  const currentIsEmpty = !activeConv || (activeConv.messages.length === 0 && !activeConv.preview)

  // 按时间分组对话
  function groupConversationsByTime(convs: typeof conversations) {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 86400000)
    const weekAgo = new Date(today.getTime() - 7 * 86400000)

    const groups = {
      今天: [] as typeof conversations,
      昨天: [] as typeof conversations,
      最近7天: [] as typeof conversations,
      更早: [] as typeof conversations,
    }

    convs.forEach((conv) => {
      const convDate = new Date(conv.updatedAt)
      if (convDate >= today) {
        groups.今天.push(conv)
      } else if (convDate >= yesterday) {
        groups.昨天.push(conv)
      } else if (convDate >= weekAgo) {
        groups.最近7天.push(conv)
      } else {
        groups.更早.push(conv)
      }
    })

    return groups
  }

  const groupedConversations = groupConversationsByTime(filteredConversations)

  function handleNewChat() {
    // 当前已是空白对话则不重复新建；否则进入空白对话，首条消息发送时再在数据库创建并以其为标题
    if (!currentIsEmpty) setActiveConversation(null)
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
      {/* 顶部：菜单按钮 + 居中标题 */}
      <header
        className="flex items-center justify-between px-2 pb-2"
        style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-700 transition hover:bg-black/5"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="8" x2="20" y2="8" />
            <line x1="4" y1="16" x2="20" y2="16" />
          </svg>
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-semibold text-gray-900">{siteName}</h1>
        <div className="w-10" />
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
              className="flex items-center justify-between px-4 pb-4"
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
              <div className="p-4">
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

            {/* 新建对话按钮（当前已是空白对话时禁用） */}
            <button
              onClick={handleNewChat}
              disabled={currentIsEmpty}
              title={currentIsEmpty ? "当前已是新对话" : "新建对话"}
              className="mx-4 mt-4 flex items-center justify-center gap-2 rounded-xl bg-gray-100 py-3 font-semibold hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-gray-100"
            >
              <Plus className="h-5 w-5" />
              新建对话
            </button>

            {/* 对话列表 */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredConversations.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">
                  {query ? "没有找到相关对话" : "暂无历史会话"}
                </p>
              ) : query ? (
                // 搜索模式：不分组，直接列表
                <div className="space-y-1">
                  {filteredConversations.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conv={conv}
                      isActive={activeConversationId === conv.id}
                      isEditing={editingId === conv.id}
                      editingTitle={editingTitle}
                      menuOpen={menuOpenId === conv.id}
                      onSetActive={() => {
                        setActiveConversation(conv.id)
                        closeDrawer()
                      }}
                      onToggleMenu={() => setMenuOpenId(menuOpenId === conv.id ? "" : conv.id)}
                      onStartEdit={() => {
                        setEditingId(conv.id)
                        setEditingTitle(conv.title)
                        setMenuOpenId("")
                      }}
                      onDelete={() => {
                        setDeleteTargetId(conv.id)
                        setMenuOpenId("")
                      }}
                      onSaveEdit={handleRename}
                      onChangeTitle={(val) => setEditingTitle(val)}
                    />
                  ))}
                </div>
              ) : (
                // 正常模式：按时间分组
                <div className="space-y-4">
                  {(Object.keys(groupedConversations) as Array<keyof typeof groupedConversations>).map((groupKey) => {
                    const groupConvs = groupedConversations[groupKey]
                    if (groupConvs.length === 0) return null
                    return (
                      <div key={groupKey}>
                        <p className="mb-2 text-xs font-medium text-gray-400">{groupKey}</p>
                        <div className="space-y-1">
                          {groupConvs.map((conv) => (
                            <ConversationItem
                              key={conv.id}
                              conv={conv}
                              isActive={activeConversationId === conv.id}
                              isEditing={editingId === conv.id}
                              editingTitle={editingTitle}
                              menuOpen={menuOpenId === conv.id}
                              onSetActive={() => {
                                setActiveConversation(conv.id)
                                closeDrawer()
                              }}
                              onToggleMenu={() => setMenuOpenId(menuOpenId === conv.id ? "" : conv.id)}
                              onStartEdit={() => {
                                setEditingId(conv.id)
                                setEditingTitle(conv.title)
                                setMenuOpenId("")
                              }}
                              onDelete={() => {
                                setDeleteTargetId(conv.id)
                                setMenuOpenId("")
                              }}
                              onSaveEdit={handleRename}
                              onChangeTitle={(val) => setEditingTitle(val)}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 底部用户信息 */}
            <Link
              href="/profile"
              onClick={closeDrawer}
              className="flex items-center gap-3 p-4 hover:bg-gray-50"
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

// 单个对话项组件
function ConversationItem({
  conv,
  isActive,
  isEditing,
  editingTitle,
  menuOpen,
  onSetActive,
  onToggleMenu,
  onStartEdit,
  onDelete,
  onSaveEdit,
  onChangeTitle,
}: {
  conv: { id: string; title: string; updatedAt: Date; messages: any[] }
  isActive: boolean
  isEditing: boolean
  editingTitle: string
  menuOpen: boolean
  onSetActive: () => void
  onToggleMenu: () => void
  onStartEdit: () => void
  onDelete: () => void
  onSaveEdit: (e: React.FormEvent) => void
  onChangeTitle: (val: string) => void
}) {
  if (isEditing) {
    return (
      <form onSubmit={onSaveEdit} className="flex gap-2 rounded-lg bg-gray-50 p-2">
        <input
          type="text"
          value={editingTitle}
          onChange={(e) => onChangeTitle(e.target.value)}
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
          autoFocus
        />
        <button
          type="submit"
          className="rounded bg-blue-500 px-3 text-sm font-medium text-white hover:bg-blue-600"
        >
          保存
        </button>
      </form>
    )
  }

  return (
    <>
      <div
        className={`relative flex items-center gap-2 rounded-lg px-3 py-2.5 transition ${
          isActive
            ? "bg-gray-100 font-medium text-gray-900"
            : "text-gray-700 hover:bg-gray-50"
        }`}
      >
        <button onClick={onSetActive} className="flex-1 truncate text-left text-sm">
          {conv.title}
        </button>
        {/* 选中时始终显示三点菜单 */}
        {isActive && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleMenu()
            }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-200"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 底部弹出菜单（仿千问样式） */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            onClick={onToggleMenu}
            className="absolute inset-0 bg-black/30"
            aria-label="关闭菜单"
          />
          <div className="relative z-10 mb-3 w-[calc(100%-1.5rem)] max-w-md rounded-3xl bg-white shadow-2xl">
            <div className="divide-y divide-gray-100">
              <button
                onClick={onStartEdit}
                className="flex w-full items-center gap-3 px-6 py-4 text-left text-gray-900 transition hover:bg-gray-50"
              >
                <Edit2 className="h-5 w-5 text-gray-600" />
                <span className="text-base">修改标题</span>
              </button>
              <button
                onClick={onDelete}
                className="flex w-full items-center gap-3 px-6 py-4 text-left text-red-600 transition hover:bg-red-50"
              >
                <Trash2 className="h-5 w-5" />
                <span className="text-base">删除</span>
              </button>
            </div>
            <button
              onClick={onToggleMenu}
              className="w-full border-t-8 border-gray-100 py-3.5 text-center text-base font-medium text-gray-700"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </>
  )
}
