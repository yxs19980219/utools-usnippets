/**
 * components/EditorPane.tsx —— 右栏详情/编辑区（打开即编辑）
 *
 * 结构：标题栏（≡折叠 / 标题 / 复制 / T备注 / ＋片段）
 *      + 备注区（添加后才有，上下横线夹住）
 *      + 编辑器（多片段时上方为 tab 行）
 *      + 底部状态栏（语言 / 行数 / 标签）
 * - 标题/备注/标签/正文变更 → 防抖 1s 自动落库
 * - markdown tab 粘贴图片 → 附件落库 → 光标处插入 ![](att://<id>)
 */
import { useMemo, useRef, useState } from 'react'
import { CopyIcon, PanelLeftIcon, PlusIcon, TypeIcon } from 'lucide-react'
import type { Fragment } from '@/types'
import { copyText } from '@/lib/clipboard'
import { useToast } from '@/lib/toast'
import { useRecords } from '@/stores/records'
import { useUi } from '@/stores/ui'
import { Button } from '@/components/ui/button'
import { CodeBlock, type CodeBlockHandle } from '@/components/editor/CodeBlock'
import { FragmentTabs } from '@/components/editor/FragmentTabs'
import { StatusBar } from '@/components/editor/StatusBar'
import { uuid } from '@/lib/uuid'

/** 选中记录时渲染（key=record._id 强制重建编辑器） */
function EditorContent({ recordId }: { recordId: string }) {
  const record = useRecords((s) => s.records.find((r) => r._id === recordId))
  const updateRecord = useRecords((s) => s.updateRecord)
  const attachImage = useRecords((s) => s.attachImage)
  const saveState = useRecords((s) => s.saveState)
  const {
    activeFragmentId,
    setActiveFragment,
    dark: isDark,
    toggleSidebar,
  } = useUi()
  const toast = useToast((s) => s.show)
  const codeRef = useRef<CodeBlockHandle>(null)

  // 注意：所有 hooks 必须位于条件 return 之前（record 可能因删除/外部同步变为 undefined，
  // 若跳过 useMemo 会导致 React 报 "Rendered fewer hooks than expected"）
  const activeFragment = record
    ? record.fragments.find((f) => f.id === activeFragmentId) ??
      record.fragments[0]
    : undefined

  const lineCount = useMemo(
    () => (activeFragment ? activeFragment.content.split('\n').length : 0),
    [activeFragment]
  )

  // 备注固定单行高度（input 形态，内容超出时横向滚动）
  // 备注折叠：无内容时不显示区域，点标题栏 T 展开；失焦且为空自动收起
  const [scenarioOpen, setScenarioOpen] = useState(false)

  if (!record || !activeFragment) return null

  // ---- 片段操作 ----
  const patchFragment = (fragId: string, patch: Partial<Fragment>) => {
    const fragments = record.fragments.map((f) =>
      f.id === fragId ? { ...f, ...patch } : f
    )
    updateRecord(record._id, { fragments })
  }

  const addFragment = () => {
    const frag: Fragment = {
      id: uuid(),
      language: activeFragment.language,
      content: '',
    }
    const fragments = [...record.fragments, frag]
    updateRecord(record._id, { fragments })
    setActiveFragment(frag.id)
  }

  const removeFragment = (fragId: string) => {
    if (record.fragments.length <= 1) {
      toast('至少保留一个片段', 'error')
      return
    }
    const idx = record.fragments.findIndex((f) => f.id === fragId)
    const fragments = record.fragments.filter((f) => f.id !== fragId)
    updateRecord(record._id, { fragments })
    if (activeFragmentId === fragId) {
      const next = fragments[Math.min(idx, fragments.length - 1)]
      setActiveFragment(next?.id ?? null)
    }
  }

  const reorderFragments = (fromId: string, toId: string) => {
    const list = [...record.fragments]
    const from = list.findIndex((f) => f.id === fromId)
    const to = list.findIndex((f) => f.id === toId)
    if (from < 0 || to < 0) return
    const [moved] = list.splice(from, 1)
    list.splice(to, 0, moved)
    updateRecord(record._id, { fragments: list })
  }

  // ---- 复制 ----
  const handleCopyCurrent = () => {
    if (!activeFragment) return
    if (copyText(activeFragment.content)) toast('已复制')
  }

  // ---- 粘贴图片（仅 markdown tab）----
  const handlePasteImage = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast('图片超过 10M 限制', 'error')
      return
    }
    const buffer = await file.arrayBuffer()
    const markdown = await attachImage(
      record._id,
      buffer,
      file.type || 'image/png'
    )
    if (!markdown) {
      toast('图片保存失败', 'error')
      return
    }
    codeRef.current?.insert(`\n${markdown}\n`)
    toast('图片已插入（二期支持就地预览）')
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-background">
      {/* 标题栏：≡ 折叠 / 标题 / 复制 / T 备注 / ＋ 片段 */}
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border px-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={toggleSidebar}
          title="折叠/展开左栏"
        >
          <PanelLeftIcon className="size-4" />
        </Button>
        <input
          value={record.title}
          onChange={(e) => updateRecord(record._id, { title: e.target.value })}
          placeholder="输入标题"
          className="w-full min-w-0 flex-1 border-none bg-transparent text-base font-semibold outline-none placeholder:font-semibold placeholder:text-muted-foreground/60"
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          onClick={() => {
            setScenarioOpen(true)
            // 展开后聚焦备注框
            requestAnimationFrame(() => {
              document
                .querySelector<HTMLInputElement>('[data-scenario-box]')
                ?.focus()
            })
          }}
          title="备注"
        >
          <TypeIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          onClick={addFragment}
          title="添加片段"
        >
          <PlusIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          onClick={handleCopyCurrent}
          title="复制当前片段"
        >
          <CopyIcon className="size-3.5" />
        </Button>
      </div>

      {/* 备注区：添加后才有，上下横线夹住（单行 input，高度贴合文字、上下对称） */}
      {(record.scenario || scenarioOpen) && (
        <div className="shrink-0 border-y border-border px-4 py-[2px]">
          <input
            data-scenario-box
            value={record.scenario}
            onChange={(e) =>
              updateRecord(record._id, { scenario: e.target.value })
            }
            onBlur={() => {
              if (!record.scenario.trim()) setScenarioOpen(false)
            }}
            placeholder="备注：什么时候用、解决什么问题…"
            autoFocus={scenarioOpen && !record.scenario}
            className="h-[18px] w-full bg-transparent px-0.5 text-sm leading-[18px] text-muted-foreground outline-none placeholder:text-muted-foreground/60 focus:text-foreground"
          />
        </div>
      )}

      {/* 片段 tab 行 + 编辑器 */}
      <div className="flex min-h-0 flex-1 flex-col px-2 pb-0">
        {record.fragments.length > 1 && (
          <FragmentTabs
            fragments={record.fragments}
            activeId={activeFragment.id}
            onSelect={setActiveFragment}
            onRemove={removeFragment}
            onReorder={reorderFragments}
          />
        )}

        <div className="group relative min-h-0 flex-1">
          <CodeBlock
            ref={codeRef}
            key={`${record._id}:${activeFragment.id}`}
            value={activeFragment.content}
            language={activeFragment.language}
            dark={isDark}
            onChange={(content) =>
              patchFragment(activeFragment.id, { content })
            }
            onPasteImage={
              activeFragment.language === 'markdown' ? handlePasteImage : undefined
            }
          />
          {/* 代码块内复制按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 size-7 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={handleCopyCurrent}
            title="复制当前片段"
          >
            <CopyIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* 底部状态栏：语言 / 行数 / 标签 / 保存失败提示 */}
      <StatusBar
        language={activeFragment.language}
        onLanguageChange={(lang) =>
          patchFragment(activeFragment.id, { language: lang })
        }
        lineCount={lineCount}
        saveState={saveState}
        tags={record.tags}
        onAddTag={(tag) =>
          updateRecord(record._id, { tags: [...record.tags, tag] })
        }
        onRemoveTag={(tag) =>
          updateRecord(record._id, {
            tags: record.tags.filter((t) => t !== tag),
          })
        }
      />
    </div>
  )
}

export function EditorPane() {
  const selectedId = useUi((s) => s.selectedId)
  const records = useRecords((s) => s.records)
  const toggleSidebar = useUi((s) => s.toggleSidebar)

  if (!selectedId) {
    return (
      <div className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 left-2 size-8"
          onClick={toggleSidebar}
          title="折叠/展开左栏"
        >
          <PanelLeftIcon className="size-4" />
        </Button>
        <p className="text-base font-medium">模式库</p>
        <p>
          {records.length === 0
            ? '点击「＋」创建第一条记录，或从列表中选择一条记录查看'
            : '从列表中选择一条记录查看/编辑'}
        </p>
        <p className="text-xs opacity-70">
          片段 = 复制用 · 笔记 = 阅读用（全部 markdown 片段自动识别为笔记）
        </p>
      </div>
    )
  }

  return <EditorContent key={selectedId} recordId={selectedId} />
}
