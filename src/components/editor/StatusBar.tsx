/**
 * components/editor/StatusBar.tsx —— 底部状态栏
 * 语言选择器 + 行数 + 标签编辑（同行）；不显示保存成功指示，
 * 仅保存失败时给出提示（数据安全底线）
 */
import { CircleAlertIcon } from 'lucide-react'
import type { SaveState } from '@/stores/records'
import { LANGUAGES } from '@/lib/languages'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TagEditor } from '@/components/editor/TagEditor'

export interface StatusBarProps {
  language: string
  onLanguageChange: (language: string) => void
  lineCount: number
  saveState: SaveState
  tags: string[]
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
}

export function StatusBar({
  language,
  onLanguageChange,
  lineCount,
  saveState,
  tags,
  onAddTag,
  onRemoveTag,
}: StatusBarProps) {
  return (
    <div className="flex h-7 shrink-0 items-center gap-3 border-t border-border bg-muted/40 px-2 text-xs text-muted-foreground">
      <div className="flex shrink-0 items-center gap-3">
        {language === 'markdown' ? (
          <span className="px-1 text-xs">Markdown</span>
        ) : (
          <Select value={language} onValueChange={onLanguageChange}>
            <SelectTrigger className="h-5 w-auto gap-1 border-0 bg-transparent px-1 text-xs shadow-none hover:bg-accent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.filter((l) => l.value !== 'markdown').map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <span>{lineCount} 行</span>
      </div>

      <div className="relative flex min-w-0 flex-1 items-center justify-end gap-1 overflow-visible">
        <TagEditor tags={tags} onAdd={onAddTag} onRemove={onRemoveTag} />
      </div>

      {saveState === 'error' && (
        <span className="flex shrink-0 items-center gap-1 text-destructive">
          <CircleAlertIcon className="size-3" />
          保存失败
        </span>
      )}
    </div>
  )
}
