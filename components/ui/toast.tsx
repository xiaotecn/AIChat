"use client"

import { create } from "zustand"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react"

type ToastType = "success" | "error" | "info"

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastState {
  toasts: ToastItem[]
  add: (message: string, type?: ToastType) => void
  remove: (id: number) => void
}

let seq = 0

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (message, type = "info") => {
    const id = ++seq
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    // 3 秒后自动消失
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 3000)
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** 便捷入口：可在任意代码（含事件处理函数）中调用，无需 hook。 */
export const toast = {
  success: (m: string) => useToastStore.getState().add(m, "success"),
  error: (m: string) => useToastStore.getState().add(m, "error"),
  info: (m: string) => useToastStore.getState().add(m, "info"),
}

const STYLES: Record<ToastType, { icon: typeof Info; cls: string }> = {
  success: { icon: CheckCircle2, cls: "border-green-200 bg-green-50 text-green-800" },
  error: { icon: AlertCircle, cls: "border-red-200 bg-red-50 text-red-800" },
  info: { icon: Info, cls: "border-blue-200 bg-blue-50 text-blue-800" },
}

/** 全局通知容器，挂载在根布局。 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const remove = useToastStore((s) => s.remove)

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => {
          const { icon: Icon, cls } = STYLES[t.type]
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex max-w-md items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-lg ${cls}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => remove(t.id)}
                className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
                aria-label="关闭"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
