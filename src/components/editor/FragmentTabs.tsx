/**
 * components/editor/FragmentTabs.tsx —— 多片段 tab 行
 * 切换 / 删除 / 拖动排序（HTML5 DnD）；添加入口统一在标题栏右侧"＋片段"
 * 仅在多片段（>1）时渲染；tab 命名"片段 1/2/3…"，语言徽标辅助识别
 */
import { useRef } from 'react'
import { XIcon } from 'lucide-react'
import type { Fragment } from '@/types'
import { languageLabel } from '@/lib/languages'
import { cn } from '@/lib/utils'

export interface FragmentTabsProps {
  fragments: Fragment[]
  activeId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onReorder: (fromId: string, toId: string) => void
}

export function FragmentTabs({
  fragments,
  activeId,
  onSelect,
  onRemove,
  onReorder,
}: FragmentTabsProps) {
  const dragId = useRef<string | null>(null)

  return (
    <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border bg-muted/40 px-2">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {fragments.map((f, i) => (
          <div
            key={f.id}
            draggable
            onDragStart={() => (dragId.current = f.id)}
            onDragOver={(e) => {
              e.preventDefault()
            }}
            onDrop={() => {
              const from = dragId.current
              dragId.current = null
              if (from && from !== f.id) onReorder(from, f.id)
            }}
            onDragEnd={() => (dragId.current = null)}
            onClick={() => onSelect(f.id)}
            className={cn(
              'group flex h-6 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-xs transition-colors select-none',
              f.id === activeId
                ? 'border-border bg-background text-foreground shadow-xs'
                : 'border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
            title={languageLabel(f.language)}
          >
            <span className="rounded-sm bg-accent px-1 py-px font-mono text-[10px] leading-none text-accent-foreground">
              {languageLabel(f.language)}
            </span>
            <span>片段 {i + 1}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove(f.id)
              }}
              className="rounded-sm opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
              title="删除片段"
            >
              <XIcon className="size-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

