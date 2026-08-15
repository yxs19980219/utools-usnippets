/**
 * lib/toast.ts —— 极简 toast（无依赖，自动 3s 消失）
 */
import { create } from 'zustand'

export interface ToastItem {
  id: number
  msg: string
  kind: 'info' | 'error'
}

interface ToastState {
  toasts: ToastItem[]
  show: (msg: string, kind?: 'info' | 'error') => void
  dismiss: (id: number) => void
}

let seq = 0

export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  show: (msg, kind = 'info') => {
    const id = ++seq
    set({ toasts: [...get().toasts, { id, msg, kind }] })
    setTimeout(() => get().dismiss(id), 3000)
  },
  dismiss: (id) =>
    set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))
