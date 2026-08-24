/**
 * components/SearchView.tsx —— 片段搜索视图（独立 feature pattern-vault-search）
 *
 * - 与主界面一致：顶部为 uTools 原生子输入框（setSubInput，窗口最顶部），下方为片段列表
 * - 窗口高度：进入搜索 = 490（内容视口），卸载恢复主界面 600；单窗口机制下的正常一次性切换
 * - 过滤：子输入框 onChange 实时驱动 query（内容/标题/场景/标签，小写 includes）
 * - 键盘：document 级 keydown 监听（子输入框焦点下页面仍可捕获按键，参照 uTools-Finder）
 *   ↑↓ 移动选中 / Enter 插入到原光标处（hideMainWindowPasteText）/
 *   Ctrl+1~0 复制对应编号片段并退出（前 10 项，0=第 10 项）
 * - 纯复制定位：无单击复制、无 toast、不进入编辑区、无管理操作
 */
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Code2Icon,
  DatabaseIcon,
  FileTextIcon,
  FolderIcon,
  MessageSquareTextIcon,
  TagIcon,
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
const FALLBACK_COLOR: Record<string, string> = {
  sql: '#4479A1',
}

/** 无品牌语言的兜底图标（lucide 语义图标） */
const FALLBACK_ICONS: Record<
  string,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  plaintext: FileTextIcon,
  sql: DatabaseIcon,
}

/** simple-icons 矢量渲染（fill currentColor，颜色由外层控制） */
function BrandIcon({
  icon,
  className,
  style,
}: {
  icon: SimpleIcon
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={style}
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

/** 视口固定 10 项；单条固定高度（行 1 22px + 行 2 17px + padding 10px） */
const VIEWPORT_COUNT = 10
const ITEM_HEIGHT = 49
/** 空态（无片段/无匹配）时窗口高度 */
const EMPTY_HEIGHT = 96
/** 主界面窗口高度（plugin.json height），退出搜索时恢复 */
const MAIN_WINDOW_HEIGHT = 600

/** 快捷复制提示：n = 视口内位置 0~9（0 = 第 10 项，显示 Ctrl+0） */
function ShortcutBadge({ n }: { n: number }) {
  return (
    <span className="flex shrink-0 items-center self-center pl-2 text-[17px] font-medium text-muted-foreground opacity-60">
      Ctrl+{n === 9 ? '0' : n + 1}
    </span>
  )
}

/** 平铺片段条目：行 1 = 标题 · 📁文件夹 · 📝备注 + 快捷键；行 2 = 语言名 · ●片段名 · 标签 */
function SnippetItem({
  entry,
  index,
  query,
  active,
  categoryName,
  viewportStart,
  onHover,
}: {
  entry: SnippetEntry
  index: number
  query: string
  active: boolean
  categoryName?: string
  viewportStart: number
  onHover: () => void
}) {
  const scenario = firstLine(entry.recordScenario)
  const metaColor = active ? 'text-accent-foreground/70' : 'text-muted-foreground'
  const simple = SIMPLE_ICONS[entry.language]
  const FallbackIcon = FALLBACK_ICONS[entry.language] ?? Code2Icon
  const iconColor = simple ? `#${simple.hex}` : FALLBACK_COLOR[entry.language]
  const inViewport = index >= viewportStart && index < viewportStart + VIEWPORT_COUNT
  return (
    <div
      data-index={index}
      onMouseEnter={onHover}
      className={cn(
        'flex h-[49px] shrink-0 items-center gap-2.5 px-2 py-[5px] text-left transition-colors',
        active
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent/60 hover:text-accent-foreground',
      )}
    >
      {/* 语言图标：品牌原生形状 + 品牌色（无底），横跨两行；无品牌色走 muted */}
      <div className="flex w-7 shrink-0 items-center justify-center self-stretch">
        {simple ? (
          <BrandIcon icon={simple} className="size-7" style={{ color: iconColor }} />
        ) : (
          <FallbackIcon
            className={cn('size-7', !iconColor && 'text-muted-foreground')}
            style={iconColor ? { color: iconColor } : undefined}
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {/* 行 1：标题（15px 粗）· 📁文件夹 · 📝备注（11px） */}
        <div className="flex min-w-0 items-center gap-2 text-[15px] leading-[22px]">
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">
              {highlight(entry.recordTitle || '未命名', query)}
            </span>
            {categoryName ? (
              <span className={cn('pl-1.5 text-[11px]', metaColor)}>
                <FolderIcon className="mr-0.5 inline size-3" />
                {categoryName}
              </span>
            ) : (
              <span className={cn('pl-1.5 text-[11px]', metaColor)}>
                <FolderIcon className="mr-0.5 inline size-3 text-amber-500 dark:text-amber-400" />
                收件箱
              </span>
            )}
            {scenario && (
              <span className={cn('pl-1.5 text-[11px]', metaColor)}>
                <MessageSquareTextIcon className="mr-0.5 inline size-3" />
                {highlight(scenario, query)}
              </span>
            )}
          </span>
        </div>
        {/* 行 2：语言名 · ●片段名 · 标签（图标 + 蓝底） */}
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] leading-[17px]">
          <span className={cn('shrink-0', metaColor)}>
            {languageLabel(entry.language)}
          </span>
          <span className={cn('flex shrink-0 items-center gap-1', metaColor)}>
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <span>{highlight(entry.name, query)}</span>
          </span>
          {entry.recordTags.length > 0 && (
            <span className="min-w-0 flex-1 truncate">
              {entry.recordTags.map((t) => (
                <span
                  key={t}
                  className="mr-1 inline-flex items-center gap-0.5 align-middle text-[10px] text-blue-600 dark:text-blue-400"
                >
                  <TagIcon className="size-2.5" />
                  {highlight(t, query)}
                </span>
              ))}
            </span>
          )}
        </div>
      </div>
      {inViewport && <ShortcutBadge n={index - viewportStart} />}
    </div>
  )
}

export function SearchView() {
  const records = useRecords((s) => s.records)
  const categories = useCategories((s) => s.categories)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  // 注册顶部 uTools 原生子输入框（与主界面一致）；卸载时移除
  useEffect(() => {
    window.utools?.setSubInput?.(
      ({ text }) => setQuery(text),
      '输入关键词搜索，↑↓选择，Ctrl+数字/C复制，Enter 插入当前光标',
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

  const empty = entries.length === 0
  const noMatch = !empty && filtered.length === 0
  // 内容高度随结果数自适应：空态 → 固定小高度；N 条 → N×49（视口 10 项封顶）
  const contentHeight = empty || noMatch
    ? EMPTY_HEIGHT
    : Math.min(filtered.length, VIEWPORT_COUNT) * ITEM_HEIGHT

  // 窗口高度：进入搜索 = 内容高度（结果数变化时动态扩缩），卸载恢复主界面(600)。
  // 单窗口机制下 600↔内容高 是必然的一次性高度切换（用户已确认接受）。
  // 动态 effect 与卸载恢复分离：contentHeight 变化时不得先回弹 600（历史跳变教训）
  useEffect(() => {
    window.utools?.setExpendHeight?.(contentHeight)
  }, [contentHeight])
  useEffect(() => {
    return () => {
      window.utools?.setExpendHeight?.(MAIN_WINDOW_HEIGHT)
    }
  }, [])

  // 视口滑动窗口起始下标（Ctrl+1~0 命中窗口内条目）
  const [viewportStart, setViewportStart] = useState(0)

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

  // 视口窗口：选中项越出可见范围时整体平移（视口固定 10 项可见，
  // 第 11 项滚入、第 1 项滚出，快捷键始终命中当前视口内条目）
  useEffect(() => {
    if (filtered.length === 0) {
      setViewportStart(0)
      return
    }
    setViewportStart((start) => {
      if (activeIndex < start) return activeIndex
      if (activeIndex >= start + VIEWPORT_COUNT) {
        return Math.min(activeIndex - VIEWPORT_COUNT + 1, filtered.length - VIEWPORT_COUNT)
      }
      return start
    })
  }, [activeIndex, filtered.length])

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
      } else if ((e.ctrlKey || e.metaKey) && /^[0-9]$/.test(e.key)) {
        // Ctrl+1~9 / Ctrl+0（视口内第 10 项）：复制对应编号片段并退出
        e.preventDefault()
        const n = e.key === '0' ? VIEWPORT_COUNT - 1 : Number(e.key) - 1
        const target = filtered[viewportStart + n]
        if (!target) return
        copyText(target.content)
        window.utools?.outPlugin?.()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [filtered, activeIndex, viewportStart])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 flex-1 items-start overflow-hidden">
        {empty || noMatch ? (
          <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
            {empty ? '还没有可复制的代码片段' : '没有匹配的片段'}
          </div>
        ) : (
          /* 内容视口自适应（N 条 × 49px，10 项封顶）：顶部对齐、窗口随结果数扩缩 */
          <div
            className="w-full overflow-hidden"
            style={{ height: contentHeight }}
          >
            {filtered
              .slice(viewportStart, viewportStart + VIEWPORT_COUNT)
              .map((entry, i) => {
                const index = viewportStart + i
                return (
                  <SnippetItem
                    key={`${entry.recordId}:${entry.fragmentId}`}
                    entry={entry}
                    index={index}
                    query={query}
                    active={activeIndex === index}
                    categoryName={categoryNameById(entry.categoryId)}
                    viewportStart={viewportStart}
                    onHover={() => setActiveIndex(index)}
                  />
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
