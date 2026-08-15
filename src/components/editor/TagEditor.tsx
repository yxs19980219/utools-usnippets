/**
 * components/editor/TagEditor.tsx —— 标签编辑：chips（可删）+ 输入添加
 * 用于底部状态栏（与语言选择器同行）
 */
import { useState } from 'react'
import { XIcon } from 'lucide-react'

export function TagEditor({
  tags,
  onAdd,
  onRemove,
}: {
  tags: string[]
  onAdd: (tag: string) => void
  onRemove: (tag: string) => void
}) {
  const [input, setInput] = useState('')

  const commit = () => {
    const tag = input.trim()
    setInput('')
    if (!tag) return
    if (tags.includes(tag)) return
    onAdd(tag)
  }

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full border border-border bg-accent/50 px-2 py-0.5 text-xs text-accent-foreground"
        >
          {tag}
          <button
            onClick={() => onRemove(tag)}
            className="rounded-sm text-muted-foreground hover:text-foreground"
            title="删除标签"
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Backspace' && !input && tags.length > 0) {
            onRemove(tags[tags.length - 1])
          }
        }}
        onBlur={commit}
        placeholder={tags.length === 0 ? '标签…' : ''}
        className="h-5 w-20 min-w-0 rounded-md border border-transparent bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground focus:border-input"
      />
    </div>
  )
}
