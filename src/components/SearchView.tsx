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
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Code2Icon,
  DatabaseIcon,
  FileTextIcon,
  FolderIcon,
} from 'lucide-react'
import {
  siC,
  siCplusplus,
  siCss,
  siGo,
  siHtml5,
  siJavascript,
  siJson,
  siMarkdown,
  siOpenjdk,
  siPhp,
  siPython,
  siReact,
  siRuby,
  siRust,
  siShell,
  siTypescript,
  siYaml,
  type SimpleIcon,
} from 'simple-icons'
import type { SnippetEntry } from '@/lib/search'
import { buildSnippetEntries, filterSnippets } from '@/lib/search'
import { copyText } from '@/lib/clipboard'
import { languageLabel } from '@/lib/languages'
import { firstLine } from '@/types'
import { useRecords } from '@/stores/records'
import { useCategories } from '@/stores/categories'
import { cn } from '@/lib/utils'

/**
 * 语言 → 品牌图标（simple-icons 官方包：图标形状 + 官方品牌色 hex 随包维护，
 * 无需手动抄色；无品牌的语言回退 lucide 语义图标 + 自定义兜底色）
 */
const SIMPLE_ICONS: Record<string, SimpleIcon> = {
  javascript: siJavascript,
  typescript: siTypescript,
  jsx: siReact,
  tsx: siTypescript,
  html: siHtml5,
  css: siCss,
  json: siJson,
  python: siPython,
  java: siOpenjdk,
  c: siC,
  cpp: siCplusplus,
  go: siGo,
  rust: siRust,
  php: siPhp,
  ruby: siRuby,
  yaml: siYaml,
  markdown: siMarkdown,
  shell: siShell,
}

/** 无品牌语言的兜底色（simple-icons 之外的语义图标） */
const FALLBACK_BRAND: Record<string, { bg: string; fg: string }> = {
  sql: { bg: '#4479A1', fg: '#fff' },
}

/** 无品牌语言的兜底图标（lucide 语义图标） */
const FALLBACK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  plaintext: FileTextIcon,
  sql: DatabaseIcon,
}

/** hex 亮度反色：浅底黑图标、深底白图标（YIQ 近似亮度） */
function contrastFg(hex: string): string {
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 150 ? '#000' : '#fff'
}

/** simple-icons 矢量渲染（fill currentColor，颜色由外层控制） */
function BrandIcon({ icon, className }: { icon: SimpleIcon; className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label={icon.title}
    >
      <path d={icon.path} />
    </svg>
  )
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

/** 平铺片段条目：语言方徽标（跨两行）+ 行 1 标题·备注 + ●片段名；行 2 语言全称·文件夹·标签 */
function SnippetItem({
  entry,
  index,
  query,
  active,
  categoryName,
  onHover,
  onCopy,
}: {
  entry: SnippetEntry
  index: number
  query: string
  active: boolean
  categoryName?: string
  onHover: () => void
  onCopy: () => void
}) {
  const scenario = firstLine(entry.recordScenario)
  const metaColor = active ? 'text-accent-foreground/70' : 'text-muted-foreground'
  const simple = SIMPLE_ICONS[entry.language]
  const FallbackIcon = FALLBACK_ICONS[entry.language] ?? Code2Icon
  const brand = simple
    ? { bg: `#${simple.hex}`, fg: contrastFg(simple.hex) }
    : FALLBACK_BRAND[entry.language]
  return (
    <div
      data-index={index}
      onClick={onCopy}
      onMouseEnter={onHover}
      className={cn(
        'flex cursor-pointer gap-1.5 px-1.5 py-1.5 text-left transition-colors',
        index > 0 && 'border-t border-border',
        active
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent/60 hover:text-accent-foreground',
      )}
    >
      {/* 语言方徽标：品牌色背景 + 反色图标，横跨两行；无品牌色走中性灰 */}
      <div
        className={cn(
          'flex w-9 shrink-0 items-center justify-center self-stretch rounded-md',
          !brand && 'bg-muted text-muted-foreground',
        )}
        style={brand ? { backgroundColor: brand.bg, color: brand.fg } : undefined}
      >
        {simple ? (
          <BrandIcon icon={simple} className="size-4" />
        ) : (
          <FallbackIcon className="size-4" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        {/* 行 1：标题（粗）· 备注截断… · ●片段名 */}
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[13px]">
            <span className="font-medium">
              {highlight(entry.recordTitle || '未命名', query)}
            </span>
            {scenario && (
              <span className={metaColor}>
                {' · '}
                {highlight(scenario, query)}
              </span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-xs">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span className={metaColor}>{highlight(entry.name, query)}</span>
          </span>
        </div>
        {/* 行 2：语言全称 · 文件夹 · 标签 */}
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className={cn('shrink-0', metaColor)}>
            {languageLabel(entry.language)}
          </span>
          {categoryName && (
            <span className={cn('flex shrink-0 items-center gap-0.5', metaColor)}>
              <FolderIcon className="size-3" />
              <span>{categoryName}</span>
            </span>
          )}
          {entry.recordTags.length > 0 && (
            <span className={cn('min-w-0 truncate', metaColor)}>
              {entry.recordTags.map((t, i) => (
                <Fragment key={i}>
                  {i > 0 && ' '}
                  {highlight(`#${t}`, query)}
                </Fragment>
              ))}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function SearchView() {
  const records = useRecords((s) => s.records)
  const categories = useCategories((s) => s.categories)
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

  // 连续同记录片段聚为一组（entries 按记录序展平、过滤后仍相邻），并记录组内起始全局下标
  const categoryNameById = useMemo(() => {
    const map = new Map(categories.map((c) => [c._id, c.name]))
    return (id: string | null) => (id ? map.get(id) : undefined)
  }, [categories])

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
          <div>
            {filtered.map((entry, index) => (
              <SnippetItem
                key={`${entry.recordId}:${entry.fragmentId}`}
                entry={entry}
                index={index}
                query={query}
                active={activeIndex === index}
                categoryName={categoryNameById(entry.categoryId)}
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
