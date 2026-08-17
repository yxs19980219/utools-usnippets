/**
 * components/Sidebar.tsx —— 左栏（masscode 式导航）
 *
 * 结构：
 * - 库：所有 / 收件箱 / 收藏 / 回收站
 * - 文件夹：用户自建分类（右键改名/删除、记录拖拽移动），未分类归收件箱
 * - 标签：标签云（点击筛选）
 * 全局搜索态下左栏失效（视觉淡化 + 禁交互）
 */
import { useState } from 'react'
import {
  CheckIcon,
  FolderIcon,
  InboxIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
  StarIcon,
  TagIcon,
  TrashIcon,
  XIcon,
} from 'lucide-react'
import { useCategories } from '@/stores/categories'
import { useRecords } from '@/stores/records'
import { useUi } from '@/stores/ui'
import { useToast } from '@/lib/toast'
import { tagCloud } from '@/lib/search'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
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
import { Button } from '@/components/ui/button'

function NavRow({
  active,
  onClick,
  onDrop,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  onDrop?: (e: React.DragEvent) => void
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      onClick={onClick}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={cn(
        'flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground',
        active && 'bg-accent text-accent-foreground'
      )}
      title={title}
    >
      {children}
    </div>
  )
}

export function Sidebar() {
  const categories = useCategories((s) => s.categories)
  const createCategory = useCategories((s) => s.create)
  const renameCategory = useCategories((s) => s.rename)
  const removeCategory = useCategories((s) => s.remove)
  const records = useRecords((s) => s.records)
  const moveRecord = useRecords((s) => s.moveRecord)
  const toast = useToast((s) => s.show)
  const { view, setView, setSettingsOpen } = useUi()

  // 新建分类 inline 输入
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  // 重命名 inline 输入
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')
  // 删除确认
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 计数均排除回收站记录
  const live = records.filter((r) => !r.deleted)
  const uncategorizedCount = live.filter((r) => r.categoryId === null).length
  const favoriteCount = live.filter((r) => r.favorite).length
  const trashCount = records.filter((r) => r.deleted).length
  const cloud = tagCloud(live)

  const isView = (type: 'all' | 'inbox' | 'favorites' | 'trash') =>
    view.type === type
  const isCategory = (id: string | null) =>
    view.type === 'category' && view.id === id
  const isTag = (tag: string) => view.type === 'tag' && view.id === tag

  const submitCreate = async () => {
    const name = newName.trim()
    setCreating(false)
    setNewName('')
    if (!name) return
    const cat = await createCategory(name)
    if (!cat) toast('分类创建失败', 'error')
  }

  const submitRename = async () => {
    const id = renamingId
    const name = renameName.trim()
    setRenamingId(null)
    if (!id || !name) return
    const ok = await renameCategory(id, name)
    if (!ok) toast('重命名失败', 'error')
  }

  const confirmDelete = async () => {
    const id = deletingId
    setDeletingId(null)
    if (!id) return
    await removeCategory(id)
    if (view.type === 'category' && view.id === id) setView({ type: 'all' })
  }

  // 拖拽记录到分类（HTML5 DnD，数据由 ListPane 行写入 dataTransfer）
  const handleDrop = (categoryId: string | null) => (e: React.DragEvent) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return
    void moveRecord(id, categoryId)
  }

  return (
    <aside className="flex w-36 shrink-0 flex-col border-r border-border bg-background text-sidebar-foreground">
      {/* 库：固定顶部 */}
      <div className="shrink-0 p-1.5">
        <div className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">
          库
        </div>
        <NavRow
          active={isView('all')}
          onClick={() => setView({ type: 'all' })}
          title="所有记录"
        >
          <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">所有</span>
          <span className="text-xs text-muted-foreground">{live.length}</span>
        </NavRow>
        <NavRow
          active={isView('inbox')}
          onClick={() => setView({ type: 'inbox' })}
          onDrop={handleDrop(null)}
          title="未分类记录（新建片段默认落这里，可拖入）"
        >
          <InboxIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">收件箱</span>
          <span className="text-xs text-muted-foreground">{uncategorizedCount}</span>
        </NavRow>
        <NavRow
          active={isView('favorites')}
          onClick={() => setView({ type: 'favorites' })}
          title="收藏的记录"
        >
          <StarIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">收藏</span>
          <span className="text-xs text-muted-foreground">{favoriteCount}</span>
        </NavRow>
        <NavRow
          active={isView('trash')}
          onClick={() => setView({ type: 'trash' })}
          title="回收站"
        >
          <TrashIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">回收站</span>
          <span className="text-xs text-muted-foreground">{trashCount}</span>
        </NavRow>
      </div>

      {/* 文件夹：标题固定，区域占 40%，内容滚动 */}
      <div className="flex min-h-0 flex-[2] flex-col">
        <div className="flex shrink-0 items-center justify-between px-2 pt-1.5 pb-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            文件夹
          </span>
          <button
            onClick={() => {
              setCreating((v) => !v)
              setNewName('')
            }}
            className="rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            title="新建分类"
          >
            <PlusIcon className="size-3.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">

        {creating && (
          <div className="flex items-center gap-1 px-2 pb-1">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitCreate()
                if (e.key === 'Escape') setCreating(false)
              }}
              onBlur={() => void submitCreate()}
              placeholder="分类名称"
              className="h-6 px-2 text-xs"
            />
            <button onClick={() => setCreating(false)} className="p-0.5 text-muted-foreground hover:text-foreground">
              <XIcon className="size-3.5" />
            </button>
          </div>
        )}

        {/* 未分类记录收编进库组"收件箱"，此处仅渲染用户自建分类 */}
        {categories.map((cat) =>
          renamingId === cat._id ? (
            <div key={cat._id} className="flex items-center gap-1 px-2 py-0.5">
              <Input
                autoFocus
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submitRename()
                  if (e.key === 'Escape') setRenamingId(null)
                }}
                onBlur={() => void submitRename()}
                className="h-6 px-2 text-xs"
              />
              <button onClick={() => void submitRename()} className="p-0.5 text-muted-foreground hover:text-foreground">
                <CheckIcon className="size-3.5" />
              </button>
            </div>
          ) : (
            <ContextMenu key={cat._id}>
              <ContextMenuTrigger asChild>
                <NavRow
                  active={isCategory(cat._id)}
                  onClick={() =>
                    setView({ type: 'category', id: cat._id })
                  }
                  onDrop={handleDrop(cat._id)}
                  title="点击筛选，右键管理，可拖入记录"
                >
                  <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{cat.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {live.filter((r) => r.categoryId === cat._id).length}
                  </span>
                </NavRow>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  onClick={() => {
                    setRenamingId(cat._id)
                    setRenameName(cat.name)
                  }}
                >
                  <PencilIcon /> 重命名
                </ContextMenuItem>
                <ContextMenuItem
                  variant="destructive"
                  onClick={() => setDeletingId(cat._id)}
                >
                  <TrashIcon /> 删除
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          )
        )}
        </div>
      </div>

      {/* 标签：标题固定，区域占 60%（中间偏下），内容滚动 */}
      {cloud.length > 0 && (
        <div className="flex min-h-0 flex-[3] flex-col">
          <div className="flex shrink-0 items-center justify-between px-2 pt-1.5 pb-1">
            <span className="text-[11px] font-medium text-muted-foreground">
              标签
            </span>
            {view.type === 'tag' && (
              <button
                onClick={() => setView({ type: 'all' })}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                清除
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
            <div className="flex flex-col gap-0.5">
              {cloud.map(({ tag, count }) => (
                <NavRow
                  key={tag}
                  active={isTag(tag)}
                  onClick={() =>
                    setView(
                      isTag(tag)
                        ? { type: 'all' }
                        : { type: 'tag', id: tag }
                    )
                  }
                  title={`标签 #${tag}`}
                >
                  <TagIcon className="size-3 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{tag}</span>
                  <span className="text-xs text-muted-foreground">
                    {count}
                  </span>
                </NavRow>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 底部：设置（居中，无分割线） */}
      <div className="flex h-8 shrink-0 items-center justify-center">
        <button
          onClick={() => setSettingsOpen(true)}
          className="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          title="设置"
        >
          <SettingsIcon className="size-3.5" />
        </button>
      </div>

      {/* 删除分类确认 */}
      <Dialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>删除分类</DialogTitle>
            <DialogDescription>
              分类下的记录将移入"未分类"，记录本身不会被删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
