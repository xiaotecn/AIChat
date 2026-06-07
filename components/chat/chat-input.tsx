"use client"

import { useState, useRef, useEffect } from "react"
import { Settings2, ArrowUp, Square, Check } from "lucide-react"
import { useChatStore } from "@/lib/store"
import { cn } from "@/lib/utils"

interface ChatInputProps {
  onSend: (message: string) => void
  onStop?: () => void
  isLoading?: boolean
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({ onSend, onStop, isLoading, disabled, placeholder = "发消息…" }: ChatInputProps) {
  const [message, setMessage] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    modelGroups,
    loadModelGroups,
    selectedModel,
    setSelectedModel,
    activeConversationId,
    updateConversation,
  } = useChatStore()

  // 加载订阅可见的模型分组（含头像）；默认选中逻辑已收敛进 store.loadModelGroups
  useEffect(() => {
    loadModelGroups()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasContent = Boolean(message.trim())

  const handleSend = () => {
    if (!message.trim() || isLoading || disabled) return
    onSend(message.trim())
    setMessage("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`
    }
  }, [message])

  // 选定某分组：写入 store，并同步当前会话的 modelId（沿用原顶栏选择器行为）
  function pickGroup(id: string) {
    setSelectedModel(id)
    if (activeConversationId) updateConversation(activeConversationId, { modelId: id })
    setSheetOpen(false)
  }

  return (
    <div
      className="bg-white px-4 pt-3 dark:bg-gray-950"
      style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      {/* 圆角卡片输入框：textarea + 右下角动作按钮 */}
      <div className="relative rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isLoading ? "正在等待回复…" : placeholder}
          disabled={disabled || isLoading}
          rows={1}
          className="block max-h-[140px] w-full resize-none bg-transparent px-4 py-4 pr-14 text-base leading-relaxed text-gray-900 outline-none placeholder:text-gray-400 disabled:opacity-60 dark:text-gray-100"
        />

        {/* 右下角圆形动作按钮：停止 / 发送 / 齿轮(选模型) */}
        <div className="absolute bottom-2.5 right-2.5">
          {isLoading && onStop ? (
            <button
              type="button"
              onClick={onStop}
              title="停止生成"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition hover:bg-red-600"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          ) : hasContent ? (
            <button
              type="button"
              onClick={handleSend}
              disabled={disabled}
              title="发送"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1a2333] text-white shadow-md transition hover:bg-[#2a3346] disabled:opacity-50"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              title="选择模型"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <Settings2 className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </div>

      {/* 选择模型底部弹层 */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            type="button"
            aria-label="关闭模型选择"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/30"
          />
          <section className="relative z-10 mb-3 w-[calc(100%-1.5rem)] max-w-md rounded-3xl bg-white p-4 shadow-2xl dark:bg-gray-900">
            <div className="mb-2.5 flex items-center justify-between">
              <b className="text-[17px] font-semibold">选择模型</b>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="text-sm font-bold text-gray-500 transition hover:text-gray-700 dark:hover:text-gray-300"
              >
                关闭
              </button>
            </div>
            <div className="grid max-h-[55vh] gap-2 overflow-y-auto">
              {modelGroups.length === 0 ? (
                <p className="flex min-h-[58px] items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 px-4 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-800">
                  当前订阅暂无可用模型
                </p>
              ) : (
                modelGroups.map((g) => {
                  const active = g.id === selectedModel
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => pickGroup(g.id)}
                      className={cn(
                        "flex min-h-[58px] items-center justify-between gap-3 rounded-2xl border px-3.5 text-left transition",
                        active
                          ? "border-[#2f6bff]/25 bg-[#2f6bff]/[0.08]"
                          : "border-gray-100 bg-gray-50 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        {g.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={g.avatarUrl}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-500 text-xs font-bold text-white">
                            {g.name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <b className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {g.name}
                        </b>
                      </span>
                      {active && <Check className="h-5 w-5 shrink-0 text-[#2f6bff]" />}
                    </button>
                  )
                })
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
