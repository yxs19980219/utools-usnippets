/**
 * components/editor/FragmentTabs.tsx —— 多片段 tab 行
 * 切换 / 拖拽排序（HTML5 DnD）；添加入口统一在标题栏右侧"＋片段"
 * 仅在多片段（>1）时渲染；tab 均分宽度，间隔竖线，选中项 accent 背景
 * 双击 tab 或右键"重命名"内联改名；悬停显示完整名称
 */
import { useLayoutEffect, useRef, useState } from 'react'
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
  const inputRef = useRef<HTMLInputElement>(null)
  const ignoreBlur = useRef(false)
  const ignoreBlurTimer = useRef<number | null>(null)

  const startRename = (f: Fragment, index: number) => {
    if (ignoreBlurTimer.current !== null) clearTimeout(ignoreBlurTimer.current)
    ignoreBlur.current = true
    ignoreBlurTimer.current = window.setTimeout(() => {
      ignoreBlur.current = false
    }, 300)
    setEditingId(f.id)
    setDraft(tabLabel(f, index))
  }

  // commit 后立即 focus+全选（双击路径无菜单，直接生效；右键路径由
  // onCloseAutoFocus 在菜单关闭瞬间接管，避免固定延时）
  useLayoutEffect(() => {
    if (editingId === null) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editingId])

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
                onDoubleClick={() => startRename(f, i)}
                title={tabLabel(f, i)}
                className={cn(
                  'group flex h-6 min-w-0 flex-1 cursor-pointer items-center justify-center px-2 text-xs select-none',
                  f.id === activeId
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground'
                )}
              >
                {editingId === f.id ? (
                  <input
                    ref={inputRef}
                    value={draft}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') cancelRename()
                      if (e.key === 'Tab') commitRename()
                    }}
                    onBlur={() => {
                      if (ignoreBlur.current) return
                      commitRename()
                    }}
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
            <ContextMenuContent
              onCloseAutoFocus={(e) => {
                e.preventDefault()
                const doFocus = () => {
                  inputRef.current?.focus()
                  inputRef.current?.select()
                }
                doFocus()
                requestAnimationFrame(doFocus)
              }}
            >
              <ContextMenuItem onClick={() => startRename(f, i)}>
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
