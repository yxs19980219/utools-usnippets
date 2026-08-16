/**
 * components/editor/FragmentTabs.tsx —— 多片段 tab 行
 * 切换 / 拖拽排序（HTML5 DnD）；添加入口统一在标题栏右侧"＋片段"
 * 仅在多片段（>1）时渲染；tab 均分宽度，间隔竖线，选中项 accent 背景
 * 双击 tab 或右键"重命名"内联改名；悬停显示完整名称
 */
import { useRef, useState } from 'react'
import { PencilIcon, TrashIcon } from 'lucide-react'
import type { Fragment } from '@/types'
import { cn } from '@/lib/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

export interface FragmentTabsProps {
  fragments: Fragment[]
  activeId: string | null
  onSelect: (id: string) => void
  onRename: (id: string, name: string) => void
  onRemove: (id: string) => void
  onReorder: (fromId: string, toId: string) => void
}

function tabLabel(f: Fragment, index: number): string {
  return f.name?.trim() || `片段 ${index + 1}`
}

export function FragmentTabs({
  fragments,
  activeId,
  onSelect,
  onRename,
  onRemove,
  onReorder,
}: FragmentTabsProps) {
  const dragId = useRef<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const startRename = (f: Fragment) => {
    setEditingId(f.id)
    setDraft(f.name ?? '')
  }

  const commitRename = () => {
    if (editingId === null) return
    onRename(editingId, draft.trim())
    setEditingId(null)
  }

  const cancelRename = () => setEditingId(null)

  return (
    <div className="flex h-6 shrink-0 items-center border-t border-b border-border">
      <div className="flex min-w-0 flex-1 items-center divide-x divide-border">
        {fragments.map((f, i) => (
          <ContextMenu key={f.id}>
            <ContextMenuTrigger asChild>
              <div
                draggable={editingId !== f.id}
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
                onClick={() => {
                  if (editingId !== f.id) onSelect(f.id)
                }}
                onDoubleClick={() => startRename(f)}
                title={tabLabel(f, i)}
                className={cn(
                  'group flex h-6 min-w-0 flex-1 cursor-pointer items-center justify-center px-2 text-xs transition-colors select-none',
                  f.id === activeId
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground'
                )}
              >
                {editingId === f.id ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') cancelRename()
                    }}
                    onBlur={commitRename}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    className="w-full min-w-0 bg-transparent text-center outline-none placeholder:text-muted-foreground/60"
                    placeholder={tabLabel(f, i)}
                  />
                ) : (
                  <span className="min-w-0 truncate">{tabLabel(f, i)}</span>
                )}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => startRename(f)}>
                <PencilIcon /> 重命名
              </ContextMenuItem>
              <ContextMenuItem
                variant="destructive"
                onClick={() => onRemove(f.id)}
              >
                <TrashIcon /> 删除
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>
    </div>
  )
}
