"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Bot, Loader2, Copy, RotateCcw, ThumbsUp, ThumbsDown, Share2, X, Download } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Message } from "@/lib/store"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/toast"

interface MessageListProps {
  messages: Message[]
  onRetry?: (messageId: string) => void
  isLoading?: boolean
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success("已复制")
  } catch {
    toast.error("复制失败")
  }
}

// 分享：移动端优先系统分享面板；不支持（多为桌面）时退化为复制
async function shareText(text: string) {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text })
      return
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return // 用户取消
      // 其它错误：落到复制兜底
    }
  }
  copyText(text)
}

// 保存图片：移动端（尤其 iOS）优先调系统分享面板（navigator.share），用户选「存储图像 / Save to Photos」即可存进相册；
// 桌面或不支持分享时退化为常规下载；都失败（多为跨域）则新窗口打开让用户长按保存。
async function saveImage(src: string) {
  try {
    const res = await fetch(src)
    const blob = await res.blob()
    const ext = (blob.type.split("/")[1] || "png").split("+")[0]
    const file = new File([blob], `image-${Date.now()}.${ext}`, { type: blob.type || "image/png" })

    if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        return
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return // 用户取消分享
        // 其他错误：落到下载兜底
      }
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch {
    window.open(src, "_blank")
    toast.info("无法直接保存，已在新窗口打开，请长按选择「存储到照片」")
  }
}

// 生图加载态：空图骨架 + 旋转 + 已用时 + 缓动进度条（指数逼近 ~95%，出图前不填满，避免虚假完成）。
// startedAt 取消息 createdAt：新发与「重载续看」都能算出真实已用时。
function ImageGenLoading({ startedAt }: { startedAt: Date }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = new Date(startedAt).getTime()
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [startedAt])

  const pct = Math.round(95 * (1 - Math.exp(-elapsed / 50)))
  const mm = Math.floor(elapsed / 60)
  const ss = String(elapsed % 60).padStart(2, "0")

  return (
    <div className="w-[220px] max-w-full">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-gray-100 to-gray-200 dark:border-gray-700 dark:from-gray-800 dark:to-gray-900">
        <div className="absolute inset-0 animate-pulse bg-gray-200/50 dark:bg-gray-700/40" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
          <Loader2 className="h-7 w-7 animate-spin" />
          <span className="text-xs">正在生成图片…</span>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
        <span>已用 {mm}:{ss}</span>
        <span>预计 1–2 分钟</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-1000 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function MessageList({ messages, onRetry, isLoading }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // 点赞/点踩：仅前端视觉反馈（无后端），按消息 id 记录
  const [feedback, setFeedback] = useState<Record<string, "up" | "down">>({})
  const toggleFeedback = (id: string, v: "up" | "down") =>
    setFeedback((prev) => {
      const next = { ...prev }
      if (next[id] === v) delete next[id]
      else next[id] = v
      return next
    })

  // 图片灯箱状态：点击聊天图片打开；zoomed 切换「适配屏幕 / 原图大小」
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  const [zoomed, setZoomed] = useState(false)

  // 打开时复位缩放；Esc 关闭
  useEffect(() => {
    if (!lightbox) return
    setZoomed(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [lightbox])

  return (
    <>
      <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center">
            <div className="space-y-2">
              <Bot className="mx-auto h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">开始新的对话</p>
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          const isAssistant = message.role === "assistant"
          const isUser = message.role === "user"
          const streaming = message.status === "sending"
          const isError = message.status === "error"
          const isLast = index === messages.length - 1
          // 助手消息生成完成且有内容时，才显示操作栏
          const showActions = isAssistant && !streaming && !!message.content
          // 生图任务进行中（占位文案以 🎨 开头）：用「空图骨架 + 计时」加载态替代纯文字
          const isImagePending = isAssistant && streaming && message.content.startsWith("🎨")
          const fb = feedback[message.id]

          return (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={cn("flex flex-col", isUser ? "items-end" : "items-start")}
            >
              {/* 用户带图提问：缩略图行（点开复用灯箱），置于文本上方 */}
              {message.images && message.images.length > 0 && (
                <div className={cn("flex flex-wrap gap-2", message.content ? "mb-2" : "", isUser ? "justify-end" : "")}>
                  {message.images.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={src}
                      alt=""
                      onClick={() => setLightbox({ src, alt: "" })}
                      className="max-h-48 max-w-[180px] cursor-zoom-in rounded-xl object-cover"
                    />
                  ))}
                </div>
              )}

              {/* 文本内容：用户=浅色气泡靠右；助手=无气泡全宽 */}
              {isUser ? (
                message.content ? (
                  <div className="max-w-[82%] whitespace-pre-wrap break-words rounded-[20px] bg-[#e9eefb] px-4 py-2.5 text-[15.5px] leading-relaxed text-[#1d1d20] dark:bg-gray-800 dark:text-gray-100">
                    {message.content}
                  </div>
                ) : null
              ) : streaming && !message.content ? (
                // 还没收到首个分片：显示「正在思考」
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-[15px]">正在思考...</span>
                </div>
              ) : isImagePending ? (
                // 生图进行中：空图骨架 + 已用时 + 缓动进度条
                <ImageGenLoading startedAt={message.createdAt} />
              ) : isError ? (
                <div className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-700 dark:border-red-900 dark:bg-red-950/40">
                  {message.content}
                </div>
              ) : (
                // 边流式边渲染；放大字号 + 加深正文颜色（贴近参考样式），生成中末尾加闪烁光标
                <div className="prose max-w-none leading-7 [--tw-prose-body:#1d1d20] [--tw-prose-bold:#0b0b0c] [--tw-prose-headings:#0b0b0c] dark:prose-invert">
                  <ReactMarkdown
                    components={{
                      code: ({ className, children, ...props }) => {
                        const match = /language-(\w+)/.exec(className || "")
                        return match ? (
                          <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-gray-100">
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        ) : (
                          <code className="rounded bg-gray-100 px-1 py-0.5 text-[0.9em] dark:bg-gray-800" {...props}>
                            {children}
                          </code>
                        )
                      },
                      img: ({ src, alt }) =>
                        src && typeof src === "string" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={src}
                            alt={alt || ""}
                            onClick={() => setLightbox({ src, alt: alt || "" })}
                            className="my-1 max-h-80 w-auto cursor-zoom-in rounded-xl border border-gray-200 transition hover:opacity-90 dark:border-gray-700"
                          />
                        ) : null,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                  {streaming && (
                    <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-current align-middle" />
                  )}
                </div>
              )}

              {/* 操作栏（助手）：复制 / 赞 / 踩 / 分享 靠左，重新生成 置最右 */}
              {showActions && (
                <div className="mt-2 flex w-full items-center gap-0.5 text-gray-400">
                  <button
                    onClick={() => copyText(message.content)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                    title="复制"
                  >
                    <Copy className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </button>
                  <button
                    onClick={() => toggleFeedback(message.id, "up")}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800",
                      fb === "up" && "text-[#2f6bff] hover:text-[#2f6bff]"
                    )}
                    title="赞"
                  >
                    <ThumbsUp className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </button>
                  <button
                    onClick={() => toggleFeedback(message.id, "down")}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800",
                      fb === "down" && "text-[#2f6bff] hover:text-[#2f6bff]"
                    )}
                    title="踩"
                  >
                    <ThumbsDown className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </button>
                  <button
                    onClick={() => shareText(message.content)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                    title="分享"
                  >
                    <Share2 className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </button>
                  {isLast && onRetry && (
                    <button
                      onClick={() => onRetry(message.id)}
                      disabled={isLoading}
                      className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40 dark:hover:bg-gray-800"
                      title="重新生成"
                    >
                      <RotateCcw className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* 图片灯箱：点击放大；灯箱内再点切换「适配屏幕 / 原图大小」；右上角下载 / 关闭；Esc 关闭 */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            className="fixed inset-0 z-[80] flex flex-col bg-black/90 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center justify-end gap-2 p-3">
              <button
                onClick={() => saveImage(lightbox.src)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                title="保存图片"
              >
                <Download className="h-5 w-5" />
              </button>
              <button
                onClick={() => setLightbox(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                title="关闭"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div
              className="flex flex-1 items-center justify-center overflow-auto p-4"
              onClick={() => setLightbox(null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <motion.img
                key={lightbox.src}
                src={lightbox.src}
                alt={lightbox.alt}
                onClick={(e) => {
                  e.stopPropagation()
                  setZoomed((z) => !z)
                }}
                className={cn(
                  "rounded-lg",
                  zoomed
                    ? "max-h-none max-w-none cursor-zoom-out"
                    : "max-h-[82vh] max-w-[92vw] cursor-zoom-in object-contain"
                )}
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
