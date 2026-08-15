/**
 * components/ToastContainer.tsx —— 全局 toast 渲染
 */
import { useToast } from '@/lib/toast'
import { cn } from '@/lib/utils'

export function ToastContainer() {
  const toasts = useToast((s) => s.toasts)
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto rounded-md border bg-popover px-3 py-1.5 text-sm shadow-md',
            t.kind === 'error'
              ? 'border-destructive/50 text-destructive'
              : 'text-popover-foreground'
          )}
        >
          {t.msg}
        </div>
      ))}
    </div>
  )
}
