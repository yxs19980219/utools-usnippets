/**
 * components/SearchView.tsx —— 片段搜索视图（独立 feature pattern-vault-search）
 *
 * - 全窗口单视图：顶部页面内输入框（autofocus）+ 下方可滚动片段列表
 * - 不用 uTools 子输入框：setSubInput 仅提供文本 onChange，无键盘事件 API，
 *   方向键 / Enter / Ctrl+C 必须由页面内输入框捕获（design.md §4）
 * - 片段级搜索：仅代码片段（排除笔记），query 匹配内容/标题/场景/标签（小写 includes）
 * - 交互：↑↓ 移动选中（与 hover 同步，自动滚动可见）；Enter → hideMainWindowPasteText
 *   （隐藏窗口并输入到原光标处）；Ctrl/Cmd+C 与单击 → copyText（留在视图，可连续复制）
 * - 纯复制定位：不做 toast、不进入编辑区、无管理操作
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { SnippetEntry } from '@/lib/search'
import { buildSnippetEntries, filterSnippets } from '@/lib/search'
import { copyText } from '@/lib/clipboard'
import { languageLabel } from '@/lib/languages'
import { useRecords } from '@/stores/records'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/** 内容预览：去掉开头的空行，取前 3 行 */
function previewText(content: string): string {
  const lines = content.split('\n')
  let start = 0
  while (start < lines.length && lines[start].trim() === '') start++
  return lines.slice(start, start + 3).join('\n')
}

/** 命中高亮：大小写不敏感，把 text 拆成 segments，命中段包 <mark> */
function highlight(text: string, query: string): ReactNode {
  const q = query.trim().toLowerCase()
  if (!q) return text
  const lower = text.toLowerCase()
  const parts: ReactNode[] = []
  let i = 0
  for (;;) {
    const idx = lower.indexOf(q, i)
    if (idx === -1) {
      parts.push(text.slice(i))
      break
    }
    if (idx > i) parts.push(text.slice(i, idx))
    parts.push(
      <mark
        key={idx}
        className="rounded-sm bg-yellow-200/80 px-0.5 text-inherit dark:bg-yellow-500/40"
      >
        {text.slice(idx, idx + q.length)}
      </mark>,
    )
    i = idx + q.length
  }
  return parts
}

function SnippetItem({
  entry,
  index,
  active,
  query,
  onCopy,
  onHover,
}: {
  entry: SnippetEntry
  index: number
  active: boolean
  query: string
  onCopy: () => void
  onHover: () => void
}) {
  return (
    <div
      data-index={index}
      onClick={onCopy}
      onMouseEnter={onHover}
      className={cn(
        'flex cursor-pointer flex-col gap-0.5 rounded-md border px-2 py-1.5 text-left transition-colors',
        active
          ? 'border-border bg-accent text-accent-foreground'
          : 'border-transparent hover:bg-accent/60 hover:text-accent-foreground',
      )}
    >
      {/* 第一行：组首显示「记录标题 · 片段名」，其余缩进显示片段名；右侧语言徽标 */}
      <div className="flex items-center gap-1.5">
        {entry.groupStart ? (
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
            {entry.recordTitle || '未命名'} · {entry.name}
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate pl-3 text-xs text-muted-foreground">
            {entry.name}
          </span>
        )}
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {languageLabel(entry.language)}
        </Badge>
      </div>
      {/* 第二行：内容预览（前 3 行，超长截断），命中词高亮 */}
      <div className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-muted-foreground line-clamp-2">
        {highlight(previewText(entry.content), query)}
      </div>
    </div>
  )
}

export function SearchView() {
  const records = useRecords((s) => s.records)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const entries = useMemo(() => buildSnippetEntries(records), [records])
  const filtered = useMemo(
    () => filterSnippets(entries, query),
    [entries, query],
  )

  // activeIndex 越界保护（列表变化 / query 过滤后）
  useEffect(() => {
    if (filtered.length === 0) {
      setActiveIndex(0)
    } else if (activeIndex >= filtered.length) {
      setActiveIndex(filtered.length - 1)
    }
  }, [filtered.length, activeIndex])

  // 选中变化时滚动到可见
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filtered.length === 0) return
    const current = filtered[Math.min(activeIndex, filtered.length - 1)]
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (!current) return
      e.preventDefault()
      // 隐藏窗口并把内容输入到打开 uTools 前所在应用的光标处
      window.utools?.hideMainWindowPasteText?.(current.content)
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
      if (!current) return
      e.preventDefault()
      copyText(current.content)
    }
  }

  const empty = entries.length === 0
  const noMatch = !empty && filtered.length === 0

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜索片段：内容 / 标题 / 场景 / 标签…"
          autoFocus
          className="h-8 flex-1"
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {empty || noMatch ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center text-sm text-muted-foreground">
            {empty ? '还没有可复制的代码片段' : '没有匹配的片段'}
          </div>
        ) : (
          <div
            ref={listRef}
            className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5"
          >
            {filtered.map((entry, index) => (
              <SnippetItem
                key={`${entry.recordId}:${entry.fragmentId}`}
                entry={entry}
                index={index}
                active={activeIndex === index}
                query={query}
                onCopy={() => copyText(entry.content)}
                onHover={() => setActiveIndex(index)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
