/**
 * components/ListPane.tsx —— 中栏记录列表（160px）
 *
 * - 列表源：左栏导航视图（库/文件夹/标签），搜索态为全库（排除回收站）
 * - 列表项：标题 + 场景首行摘要 + hover 语言徽标（无类型图标）
 * - 右键菜单：收藏/取消收藏、移动分类、导出图片、移入回收站；
 *   回收站视图内：恢复 / 彻底删除
 * - 拖拽移动分类（HTML5 DnD，目标在 Sidebar 分类行）
 */
import { useMemo, useState } from 'react'
import {
  CopyIcon,
  FileCode2Icon,
  FileImageIcon,
  FileTextIcon,
  FolderInputIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  StarIcon,
  TrashIcon,
  XIcon,
} from 'lucide-react'
import type { PatternRecord } from '@/types'
import { firstLine } from '@/types'
import { sortByRecent, filterPatterns } from '@/lib/search'
import { listMeta } from '@/lib/icons'
import { copyText } from '@/lib/clipboard'
import { useRecords } from '@/stores/records'
import { useCategories } from '@/stores/categories'
import { useUi, type ViewState } from '@/stores/ui'
import { useToast } from '@/lib/toast'
import { exportRecordImages } from '@/lib/export-images'
import { cn } from '@/lib/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

/** 按左栏导航视图过滤记录（排除/只含回收站） */
function byView(records: PatternRecord[], view: ViewState): PatternRecord[] {
  switch (view.type) {
    case 'favorites':
      return records.filter((r) => r.favorite && !r.deleted)
    case 'trash':
      return records.filter((r) => r.deleted)
    case 'inbox':
      return records.filter((r) => !r.deleted && r.categoryId === null)
    case 'category':
      return records.filter(
        (r) => !r.deleted && r.categoryId === (view.id ?? null)
      )
    case 'tag':
      return records.filter(
        (r) => !r.deleted && typeof view.id === 'string' && r.tags.includes(view.id)
      )
    default:
      return records.filter((r) => !r.deleted)
  }
}

function viewLabel(view: ViewState, count: number, categoryName?: string) {
  switch (view.type) {
    case 'favorites':
      return `收藏 · ${count} 条`
    case 'trash':
      return `回收站 · ${count} 条`
    case 'inbox':
      return `收件箱 · ${count} 条`
    case 'category':
      return `${view.id === null ? '未分类' : (categoryName ?? '分类')} · ${count} 条`
    case 'tag':
      return `#${view.id} · ${count} 条`
    default:
      return `所有 · ${count} 条`
  }
}

function ListItem({
  record,
  selected,
  inTrash,
  onSelect,
  onMoveToTrash,
  onForeverDelete,
}: {
  record: PatternRecord
  selected: boolean
  inTrash: boolean
  onSelect: () => void
  onMoveToTrash?: () => void
  onForeverDelete?: () => void
}) {
  const categories = useCategories((s) => s.categories)
  const moveRecord = useRecords((s) => s.moveRecord)
  const toggleFavorite = useRecords((s) => s.toggleFavorite)
  const restoreFromTrash = useRecords((s) => s.restoreFromTrash)
  const toast = useToast((s) => s.show)
  const [confirmForever, setConfirmForever] = useState(false)
  const meta = listMeta(record)

  const handleCopy = () => {
    const content = record.fragments.map((f) => f.content).join('\n\n')
    if (copyText(content)) toast('已复制')
  }

  const handleExportImages = async () => {
    const n = await exportRecordImages(record)
    if (n === null) return
    toast(n > 0 ? `已导出 ${n} 张图片` : '该记录没有图片附件', n > 0 ? 'info' : 'error')
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            draggable={!inTrash}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', record._id)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onClick={onSelect}
            className={cn(
              'group relative flex cursor-pointer flex-col gap-0.5 rounded-md border px-2 py-1.5 text-left transition-colors',
              selected
                ? 'border-border bg-accent text-accent-foreground'
                : 'border-transparent hover:bg-accent/60 hover:text-accent-foreground'
            )}
          >
            <div className="flex items-center gap-1.5">
              {meta.isNote ? (
                <FileTextIcon className="size-3 shrink-0 text-muted-foreground" />
              ) : (
                <FileCode2Icon className="size-3 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                {record.title || '未命名'}
              </span>
            </div>
            {record.scenario && (
              <span className="truncate pl-1 text-xs text-muted-foreground">
                {firstLine(record.scenario)}
              </span>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {inTrash ? (
            <>
              <ContextMenuItem
                onClick={() => void restoreFromTrash(record._id)}
              >
                <RotateCcwIcon /> 恢复
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                onClick={() => setConfirmForever(true)}
              >
                <TrashIcon /> 彻底删除
              </ContextMenuItem>
            </>
          ) : (
            <>
              <ContextMenuItem onClick={handleCopy}>
                <CopyIcon /> 复制
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => void toggleFavorite(record._id)}
              >
                <StarIcon /> {record.favorite ? '取消收藏' : '收藏'}
              </ContextMenuItem>
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <FolderInputIcon /> 移动分类
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <ContextMenuItem
                    onClick={() => void moveRecord(record._id, null)}
                  >
                    未分类
                  </ContextMenuItem>
                  {categories.map((c) => (
                    <ContextMenuItem
                      key={c._id}
                      onClick={() => void moveRecord(record._id, c._id)}
                    >
                      {c.name}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuItem onClick={() => void handleExportImages()}>
                <FileImageIcon /> 导出图片
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                onClick={onMoveToTrash}
              >
                <TrashIcon /> 移入回收站
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* 彻底删除确认 */}
      <Dialog open={confirmForever} onOpenChange={setConfirmForever}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>彻底删除</DialogTitle>
            <DialogDescription>
              将永久删除「{record.title || '未命名'}」及其图片附件，此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmForever(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmForever(false)
                onForeverDelete?.()
              }}
            >
              彻底删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function ListPane() {
  const records = useRecords((s) => s.records)
  const categories = useCategories((s) => s.categories)
  const createRecord = useRecords((s) => s.createRecord)
  const deleteForever = useRecords((s) => s.deleteForever)
  const {
    selectedId,
    setSelected,
    setActiveFragment,
    searchQuery,
    setSearchQuery,
    view,
  } = useUi()

  // 搜索词叠加当前视图过滤（左栏保持可用，切换视图时搜索词保留）
  const list = useMemo(() => {
    const inView = byView(records, view)
    if (searchQuery) {
      return sortByRecent(filterPatterns(inView, { query: searchQuery }))
    }
    return sortByRecent(inView)
  }, [records, view, searchQuery])

  const handleNew = async (kind: 'snippet' | 'note') => {
    const record = await createRecord(kind)
    if (record) {
      setSelected(record._id)
      setActiveFragment(record.fragments[0]?.id ?? null)
    }
  }

  const onSelect = (record: PatternRecord) => {
    setSelected(record._id)
    setActiveFragment(record.fragments[0]?.id ?? null)
  }

  // 移入回收站 / 彻底删除：若目标为当前选中记录，清空选中
  const clearSelectionIfNeeded = (id: string) => {
    if (selectedId === id) {
      setSelected(null)
      setActiveFragment(null)
    }
  }

  const categoryName =
    view.type === 'category' && view.id !== null
      ? categories.find((c) => c._id === view.id)?.name
      : undefined

  const header = searchQuery ? (
    // 搜索态：全局搜索词 + 清除，无新建
    <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border px-1">
      <div className="flex min-w-0 flex-1 items-center gap-1 text-xs text-muted-foreground">
        <SearchIcon className="size-3 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{searchQuery}</span>
        <button
          onClick={() => setSearchQuery('')}
          className="shrink-0 rounded-sm p-0.5 hover:bg-accent hover:text-accent-foreground"
          title="退出搜索"
        >
          <XIcon className="size-3" />
        </button>
      </div>
    </div>
  ) : (
    // 浏览态：视图提示（灰色文字）+ 新建
    <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border px-2">
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {viewLabel(view, list.length, categoryName)}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            title="新建"
          >
            <PlusIcon className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-28">
          <DropdownMenuItem onSelect={() => void handleNew('snippet')}>
            <FileCode2Icon className="size-3.5" />
            片段
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void handleNew('note')}>
            <FileTextIcon className="size-3.5" />
            笔记
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  // 空状态：按视图区分文案
  if (records.length === 0) {
    return (
      <div className="flex w-[160px] shrink-0 flex-col border-r border-border bg-background">
        {header}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
          <p>还没有记录</p>
          <p className="text-xs">
            点击「＋」创建第一条记录，沉淀你的第一个解法
          </p>
        </div>
      </div>
    )
  }

  if (list.length === 0) {
    return (
      <div className="flex w-[160px] shrink-0 flex-col border-r border-border bg-background">
        {header}
        <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center text-sm text-muted-foreground">
          {view.type === 'trash'
            ? '回收站是空的'
            : searchQuery
              ? '没有匹配的记录'
              : '这个视图下没有记录'}
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-[160px] shrink-0 flex-col border-r border-border bg-background">
      {header}
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
        {list.map((record) => (
          <ListItem
            key={record._id}
            record={record}
            selected={selectedId === record._id}
            inTrash={view.type === 'trash'}
            onSelect={() => onSelect(record)}
            onMoveToTrash={() => {
              void useRecords.getState().moveToTrash(record._id)
              clearSelectionIfNeeded(record._id)
            }}
            onForeverDelete={() => {
              clearSelectionIfNeeded(record._id)
              void deleteForever(record._id)
            }}
          />
        ))}
      </div>
    </div>
  )
}
