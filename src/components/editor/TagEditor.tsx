/**
 * components/editor/TagEditor.tsx —— 标签编辑：chips（带图标蓝色样式）+ 输入添加
 * 输入时从全库已有标签中智能提示（建议列表向上弹出），Enter/点击采纳
 */
import { useMemo, useState } from 'react'
import { TagIcon, XIcon } from 'lucide-react'
import { useRecords } from '@/stores/records'
import { cn } from '@/lib/utils'

export function TagEditor({
  tags,
  onAdd,
  onRemove,
}: {
  tags: string[]
  onAdd: (tag: string) => void
  onRemove: (tag: string) => void
}) {
  const records = useRecords((s) => s.records)
  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(0)

  // 全库已有标签（去重、按使用频率排序）作为提示候选
  const candidates = useMemo(() => {
    const count = new Map<string, number>()
    for (const r of records) {
      if (r.deleted) continue
      for (const t of r.tags) {
        count.set(t, (count.get(t) ?? 0) + 1)
      }
    }
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([t]) => t)
  }, [records])

  // 按输入过滤：包含匹配、排除已添加
  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase()
    if (!q) return []
    return candidates.filter(
      (t) => !tags.includes(t) && t.toLowerCase().includes(q)
    )
  }, [candidates, input, tags])

  const commit = (tag: string) => {
    const t = tag.trim()
    setInput('')
    setActiveSuggestion(0)
    if (!t) return
    if (tags.includes(t)) return
    onAdd(t)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // 有建议时采纳当前高亮建议，否则提交自定义输入
      if (suggestions.length > 0) {
        commit(suggestions[Math.min(activeSuggestion, suggestions.length - 1)])
      } else {
        commit(input)
      }
      return
    }
    if (suggestions.length > 0 && e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestion((i) => (i + 1) % suggestions.length)
      return
    }
    if (suggestions.length > 0 && e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestion((i) =>
        i - 1 < 0 ? suggestions.length - 1 : i - 1
      )
      return
    }
    if (e.key === 'Escape') {
      setFocused(false)
      return
    }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      onRemove(tags[tags.length - 1])
    }
  }

const showSuggestions =
    focused && suggestions.length > 0

  return (
    <div className="relative flex min-w-0 flex-1 items-center">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex shrink-0 items-center gap-1 rounded-md bg-blue-600/10 px-1.5 py-0.5 text-xs text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
          >
            <TagIcon className="size-3" />
            {tag}
            <button
              onClick={() => onRemove(tag)}
              className="rounded-sm text-blue-600/60 hover:text-blue-700 dark:text-blue-400/60 dark:hover:text-blue-300"
              title="删除标签"
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setActiveSuggestion(0)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            if (input.trim()) commit(input)
          }}
          placeholder={tags.length === 0 ? '标签…' : ''}
          className="h-5 w-20 min-w-0 shrink-0 rounded-md border border-transparent bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground focus:border-input"
        />
      </div>

      {/* 智能提示：向上弹出（状态栏在底部），匹配全库已有标签 */}
      {showSuggestions && (
        <div className="absolute right-0 bottom-full z-50 mb-1 max-h-40 w-40 overflow-y-auto rounded-md border bg-popover py-1 text-xs text-popover-foreground shadow-lg">
          {suggestions.map((t, i) => (
            <button
              key={t}
              type="button"
              onMouseDown={(e) => {
                // 先于 blur 提交（onMouseDown 早于 input blur）
                e.preventDefault()
                commit(t)
              }}
              onMouseEnter={() => setActiveSuggestion(i)}
              className={cn(
                'flex w-full items-center gap-1.5 px-2 py-1 text-left',
                i === activeSuggestion && 'bg-accent text-accent-foreground'
              )}
            >
              <TagIcon className="size-3 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate">{t}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}