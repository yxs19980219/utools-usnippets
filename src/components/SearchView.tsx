/**
 * components/SearchView.tsx —— 片段搜索视图（独立 feature pattern-vault-search）
 *
 * - 与主界面一致：顶部为 uTools 原生子输入框（setSubInput，窗口最顶部），下方为片段列表
 * - 过滤：子输入框 onChange 实时驱动 query（内容/标题/场景/标签，小写 includes）
 * - 键盘：document 级 keydown 监听（子输入框焦点下页面仍可捕获按键，参照 uTools-Finder）
 *   ↑↓ 移动选中 / Enter 插入到原光标处（hideMainWindowPasteText）/ Ctrl+C 复制并退出
 * - 复制：单击 copyText 复制到剪贴板（可连续复制，留在视图）
 * - 纯复制定位：不做 toast、不进入编辑区、无管理操作
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { SnippetEntry } from '@/lib/search'
import { buildSnippetEntries, filterSnippets, previewSnippet } from '@/lib/search'
import { copyText } from '@/lib/clipboard'
import { languageLabel } from '@/lib/languages'
import { useRecords } from '@/stores/records'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

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
  query,
  active,
  onHover,
  onCopy,
}: {
  entry: SnippetEntry
  index: number
  query: string
  active: boolean
  onHover: () => void
  onCopy: () => void
}) {
  return (
    <div
      data-index={index}
      onClick={onCopy}
      onMouseEnter={onHover}
      className={cn(
        'cursor-pointer flex-col gap-0.5 rounded-md border px-2 py-1.5 text-left transition-colors',
        'flex',
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
        {highlight(previewSnippet(entry.content), query)}
      </div>
    </div>
  )
}

export function SearchView() {
  const records = useRecords((s) => s.records)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // 注册顶部 uTools 原生子输入框（与主界面一致）；卸载时移除
  useEffect(() => {
    window.utools?.setSubInput?.(
      ({ text }) => setQuery(text),
      '搜索片段：内容 / 标题 / 场景 / 标签…',
      true,
    )
    return () => {
      window.utools?.removeSubInput?.()
    }
  }, [])

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

  // document 级键盘监听：焦点在 uTools 子输入框时页面仍能捕获按键（参照 uTools-Finder）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
        // 复制后退出 uTools（剪贴板已就绪，可去目标应用粘贴）
        window.utools?.outPlugin?.()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [filtered, activeIndex])

  const empty = entries.length === 0
  const noMatch = !empty && filtered.length === 0

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5" ref={listRef}>
        {empty || noMatch ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
            {empty ? '还没有可复制的代码片段' : '没有匹配的片段'}
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((entry, index) => (
              <SnippetItem
                key={`${entry.recordId}:${entry.fragmentId}`}
                entry={entry}
                index={index}
                query={query}
                active={activeIndex === index}
                onHover={() => setActiveIndex(index)}
                onCopy={() => copyText(entry.content)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
