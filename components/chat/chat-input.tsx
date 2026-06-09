"use client"

import { useState, useRef, useEffect } from "react"
import { ArrowUp, Square, Check, ChevronDown, X } from "lucide-react"
import { useChatStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { downscaleImageToDataUrl } from "@/lib/image"
import { toast } from "@/components/ui/toast"

interface ChatInputProps {
  onSend: (message: string, images?: string[]) => void
  onStop?: () => void
  isLoading?: boolean
  disabled?: boolean
  placeholder?: string
  // 从对话里「引用」的图片（站内路径 / 链接 / dataURI）；值变化时注入到待发送图片列表
  injectImage?: string | null
  onInjected?: () => void
}

// 单条消息最多带几张图（与后端一致）
const MAX_IMAGES = 4

export function ChatInput({ onSend, onStop, isLoading, disabled, placeholder = "发消息…", injectImage, onInjected }: ChatInputProps) {
  const [message, setMessage] = useState("")
  const [images, setImages] = useState<string[]>([]) // 当前待发送图片（data URI）
  const [sheetOpen, setSheetOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const {
    modelGroups,
    loadModelGroups,
    selectedModel,
    setSelectedModel,
    activeConversationId,
    updateConversation,
  } = useChatStore()

  // 加载订阅可见的模型分组（含头像 / vision 标记）；默认选中逻辑已收敛进 store.loadModelGroups
  useEffect(() => {
    loadModelGroups()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedGroup = modelGroups.find((g) => g.id === selectedModel)
  // 仅「视觉分组」显示上传图片按钮（允许带图提问）
  const canVision = !!selectedGroup?.vision

  // 切到非视觉分组时清掉已选图片，避免误带到不支持读图的模型
  useEffect(() => {
    if (!canVision && images.length) setImages([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canVision])

  // 引用对话里的图片：拉取（站内路径/链接）或直接用（dataURI），压缩后加入待发送列表。
  // 仅视觉分组可带图；满 4 张或非视觉分组时给出提示。处理完通知父级清空引用，便于再次引用同一张。
  useEffect(() => {
    if (!injectImage) return
    const run = async () => {
      if (!canVision) {
        toast.info("请先切换到识图分组，再引用图片")
        return
      }
      if (images.length >= MAX_IMAGES) {
        toast.info(`最多上传 ${MAX_IMAGES} 张图片`)
        return
      }
      try {
        let dataUrl: string
        if (injectImage.startsWith("data:")) {
          dataUrl = injectImage
        } else {
          const res = await fetch(injectImage)
          const blob = await res.blob()
          const file = new File([blob], "ref", { type: blob.type || "image/png" })
          dataUrl = await downscaleImageToDataUrl(file, 1024)
        }
        setImages((prev) => (prev.length >= MAX_IMAGES ? prev : [...prev, dataUrl]))
      } catch {
        toast.error("引用图片失败")
      }
    }
    run().finally(() => onInjected?.())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injectImage])

  // 必须已选中有效分组（selectedGroup 存在）才能发送：避免分组列表尚未加载完就发出，
  // 导致后端拿到的不是分组 id、当作「非分组」绕过系统提示词/关键词/视觉等分组逻辑。
  const canSend =
    (Boolean(message.trim()) || images.length > 0) && !isLoading && !disabled && !!selectedGroup

  const handleSend = () => {
    if ((!message.trim() && images.length === 0) || isLoading || disabled) return
    if (!selectedGroup) {
      toast.info("模型加载中，请稍候…")
      return
    }
    onSend(message.trim(), images.length ? images : undefined)
    setMessage("")
    setImages([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 选图 → 压缩成 data URI（最长边 1024px，让模型看清细节）→ 入列（最多 MAX_IMAGES 张）
  const handlePickImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const room = MAX_IMAGES - images.length
    if (room <= 0) {
      toast.info(`最多上传 ${MAX_IMAGES} 张图片`)
      return
    }
    for (const file of Array.from(files).slice(0, room)) {
      try {
        const dataUrl = await downscaleImageToDataUrl(file, 1024)
        setImages((prev) => (prev.length >= MAX_IMAGES ? prev : [...prev, dataUrl]))
      } catch (e) {
        toast.error((e as Error).message || "图片处理失败")
      }
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
      {/* 圆角卡片：图片预览行(可选) + 文本框 + 底部动作行 */}
      <div className="rounded-[22px] border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {/* 已选图片缩略图（右上角 × 移除） */}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {images.map((src, i) => (
              <div key={i} className="relative h-16 w-16">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="h-16 w-16 rounded-lg border border-gray-200 object-cover dark:border-gray-700"
                />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900/80 text-white shadow"
                  aria-label="移除图片"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isLoading ? "正在等待回复…" : placeholder}
          disabled={disabled || isLoading}
          rows={1}
          className="block max-h-[140px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-base leading-relaxed text-gray-900 outline-none placeholder:text-gray-400 disabled:opacity-60 dark:text-gray-100"
        />

        {/* 底部动作行：左=上传(仅视觉分组)+选模型胶囊；右=发送/停止 */}
        <div className="flex items-center gap-2 px-2.5 pb-2.5 pt-1">
          {canVision && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handlePickImages(e.target.files)
                  e.target.value = ""
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                title="上传图片"
                disabled={images.length >= MAX_IMAGES}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                <svg className="h-[19px] w-[19px]" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
                  <path d="M269.44 256l23.296-75.381333A74.666667 74.666667 0 0 1 364.074667 128h295.850666a74.666667 74.666667 0 0 1 71.338667 52.618667L754.56 256H821.333333c64.8 0 117.333333 52.533333 117.333334 117.333333v426.666667c0 64.8-52.533333 117.333333-117.333334 117.333333H202.666667c-64.8 0-117.333333-52.533333-117.333334-117.333333V373.333333c0-64.8 52.533333-117.333333 117.333334-117.333333h66.773333z m23.605333 64H202.666667a53.333333 53.333333 0 0 0-53.333334 53.333333v426.666667a53.333333 53.333333 0 0 0 53.333334 53.333333h618.666666a53.333333 53.333333 0 0 0 53.333334-53.333333V373.333333a53.333333 53.333333 0 0 0-53.333334-53.333333h-90.378666a32 32 0 0 1-30.570667-22.549333l-30.272-97.930667a10.666667 10.666667 0 0 0-10.186667-7.52H364.074667a10.666667 10.666667 0 0 0-10.186667 7.52l-30.272 97.92A32 32 0 0 1 293.045333 320zM512 725.333333c-88.362667 0-160-71.637333-160-160 0-88.362667 71.637333-160 160-160 88.362667 0 160 71.637333 160 160 0 88.362667-71.637333 160-160 160z m0-64a96 96 0 1 0 0-192 96 96 0 0 0 0 192z" fill="currentColor" />
                </svg>
              </button>
            </>
          )}

          {/* 模型选择胶囊（头像 + 名称 + 下拉） */}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            title="选择模型"
            className="flex h-9 min-w-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white pl-1.5 pr-2.5 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            {selectedGroup?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedGroup.avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-500 text-[11px] font-bold text-white">
                {(selectedGroup?.name ?? "AI").slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="max-w-[120px] truncate font-medium">{selectedGroup?.name ?? "选择模型"}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
          </button>

          {/* 发送 / 停止 */}
          <div className="ml-auto">
            {isLoading && onStop ? (
              <button
                type="button"
                onClick={onStop}
                title="停止生成"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition hover:bg-red-600"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                title="发送"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2f6bff] text-white shadow-md transition hover:bg-[#1e5bef] disabled:opacity-40"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            )}
          </div>
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
                        {g.vision && (
                          <span className="shrink-0 rounded bg-[#2f6bff]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#2f6bff]">
                            识图
                          </span>
                        )}
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
