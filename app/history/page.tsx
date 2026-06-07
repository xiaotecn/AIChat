"use client"

import { useEffect } from "react"
import { useChatStore } from "@/lib/store"
import { formatDate } from "@/lib/utils"
import { MessageSquare, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function HistoryPage() {
  const { conversations, setActiveConversation, removeConversation, loadConversations } =
    useChatStore()

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id)
    window.location.href = "/chat"
  }

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm("确定要删除这个对话吗？")) {
      removeConversation(id)
    }
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-950">
      {/* 顶部标题 */}
      <header className="border-b border-gray-200 px-4 py-4 dark:border-gray-800">
        <h1 className="text-xl font-bold">历史记录</h1>
        <p className="mt-1 text-sm text-gray-500">共 {conversations.length} 个对话</p>
      </header>

      {/* 对话列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {conversations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <MessageSquare className="h-12 w-12 text-gray-400" />
            <p className="mt-4 text-sm text-gray-500">还没有历史对话</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleSelectConversation(conversation.id)}
                className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-blue-500 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    {conversation.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                    {conversation.messages[conversation.messages.length - 1]?.content || "暂无消息"}
                  </p>
                  <p className="mt-2 text-xs text-gray-400">
                    {formatDate(conversation.updatedAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => handleDeleteConversation(conversation.id, e)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
