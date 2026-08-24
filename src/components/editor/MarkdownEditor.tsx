/**
 * components/editor/MarkdownEditor.tsx —— 二期：Obsidian 式即时渲染编辑器
 *
 * atomic 底层组合（非 React wrapper：wrapper 无法注入图片 resolver）：
 * - inlinePreview / tables / atomicMarkdownSyntax / atomicEditorTheme（@atomic-editor/editor）
 * - imageBlocks 仿写版（att:// → blob resolver，见 lib/atomic/image-blocks.ts）
 * - mathPlugin / blockMathField（codemirror-live-markdown，KaTeX 经 window.katex 全局）
 * - markdown 格式快捷键（仅本编辑器）
 *
 * 对外接口与 CodeBlock 一致（value/onChange/language/onPasteImage/dark）；
 * 记录切换由父组件 key 重建（documentId 语义，undo/光标按记录隔离）。
 * 本模块随 EditorPane 动态 import 拆分（atomic + KaTeX 只在 markdown 编辑时加载）。
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightSpecialChars,
  keymap,
  rectangularSelection,
} from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands'
import {
  LanguageDescription,
  LanguageSupport,
  StreamLanguage,
  indentOnInput,
} from '@codemirror/language'
import {
  markdown,
  markdownKeymap,
  markdownLanguage,
} from '@codemirror/lang-markdown'
import { search, searchKeymap } from '@codemirror/search'
import {
  atomicEditorTheme,
  atomicMarkdownSyntax,
  autoCloseCodeFence,
  extendEmphasisPair,
  highlightMarkdown,
  inlinePreview,
  startAsteriskList,
  tables,
} from '@atomic-editor/editor'
import { blockMathField, mathPlugin } from 'codemirror-live-markdown'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import '@atomic-editor/editor/styles.css'
import { imageBlocks, imageBlocksRefreshEffect } from '@/lib/atomic/image-blocks'
import { markdownFormatKeymap } from '@/lib/atomic/markdown-format'
import {
  type BlobUrlRef,
  imageToBlobUrl,
  resolveAttRef,
  scanAttachmentRefs,
} from '@/lib/attachment'

// codemirror-live-markdown 的 renderMath 从 window.katex 读 KaTeX（不 import）。
// katex 包已自带 Window.katex 全局声明，此处只需运行时注入
;(window as unknown as { katex?: unknown }).katex = katex

/** 代码块内嵌高亮语言（仅一期已装的语言包，惰性加载） */
const CODE_LANGUAGES = [
  LanguageDescription.of({
    name: 'JavaScript',
    alias: ['js', 'jsx'],
    extensions: ['js', 'mjs', 'cjs', 'jsx'],
    load: () =>
      import('@codemirror/lang-javascript').then((m) =>
        m.javascript({ jsx: true })
      ),
  }),
  LanguageDescription.of({
    name: 'TypeScript',
    alias: ['ts', 'tsx'],
    extensions: ['ts', 'mts', 'cts', 'tsx'],
    load: () =>
      import('@codemirror/lang-javascript').then((m) =>
        m.javascript({ typescript: true, jsx: true })
      ),
  }),
  LanguageDescription.of({
    name: 'Python',
    alias: ['py'],
    extensions: ['py'],
    load: () => import('@codemirror/lang-python').then((m) => m.python()),
  }),
  LanguageDescription.of({
    name: 'SQL',
    extensions: ['sql'],
    load: () => import('@codemirror/lang-sql').then((m) => m.sql()),
  }),
  LanguageDescription.of({
    name: 'Shell',
    alias: ['sh', 'bash'],
    extensions: ['sh', 'bash'],
    load: () =>
      import('@codemirror/legacy-modes/mode/shell').then(
        (m) => new LanguageSupport(StreamLanguage.define(m.shell))
      ),
  }),
]

export interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  language: string
  dark: boolean
  /** 仅 markdown tab 由父组件传入（粘贴图片 → 附件） */
  onPasteImage?: (file: File) => void
}

export interface MarkdownEditorHandle {
  /** 在光标处插入文本（图片粘贴用） */
  insert: (text: string) => void
  focus: () => void
}

export const MarkdownEditor = forwardRef<
  MarkdownEditorHandle,
  MarkdownEditorProps
>(function MarkdownEditor({ value, onChange, dark, onPasteImage }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onPasteImageRef = useRef(onPasteImage)
  // 图片 blob 预取 Map：扩展在 mount 时一次性捕获 resolver 闭包（引用此 ref），
  // Map 内容后续可增量更新，无需重建扩展
  const blobMapRef = useRef(new Map<string, BlobUrlRef>())

  useEffect(() => {
    onChangeRef.current = onChange
    onPasteImageRef.current = onPasteImage
  })

  useImperativeHandle(ref, () => ({
    insert(text) {
      const view = viewRef.current
      if (!view) return
      view.dispatch({
        changes: { from: view.state.selection.main.head, insert: text },
      })
      view.focus()
    },
    focus() {
      viewRef.current?.focus()
    },
  }))

  // 挂载（仅一次）：扩展一次性捕获，后续语言/主题变更走父组件重建
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // 图片 resolver：att:// 未预取到 blob → null（显示占位 widget）；非附件直通
    const resolveImage = (src: string): string | null | undefined => {
      const attId = resolveAttRef(src)
      if (!attId) return undefined
      return blobMapRef.current.get(attId)?.url ?? null
    }

    // uTools 环境链接走系统浏览器
    const openLink = (url: string) => {
      const u = (window as unknown as {
        utools?: { shellOpenExternal?: (u: string) => void }
      }).utools
      if (u?.shellOpenExternal) u.shellOpenExternal(url)
      else window.open(url, '_blank', 'noopener,noreferrer')
    }

    const view = new EditorView({
      parent: el,
      state: EditorState.create({
        doc: value,
        extensions: [
          highlightSpecialChars(),
          history(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          rectangularSelection(),
          highlightActiveLine(),
          // Obsidian 式括号配对
          closeBrackets(),
          startAsteriskList,
          extendEmphasisPair,
          autoCloseCodeFence,
          EditorView.lineWrapping,
          // 文档内搜索面板（CM6 内置默认面板）
          search({ top: true }),
          // GFM parser（表格/删除线/任务列表）
          markdown({
            base: markdownLanguage,
            codeLanguages: CODE_LANGUAGES,
            extensions: highlightMarkdown,
          }),
          markdownLanguage.data.of({
            closeBrackets: {
              brackets: ['(', '[', '{', "'", '"', '*', '_', '`'],
            },
          }),
          atomicMarkdownSyntax,
          atomicEditorTheme,
          keymap.of([
            ...closeBracketsKeymap,
            ...historyKeymap,
            ...searchKeymap,
            ...markdownKeymap,
            indentWithTab,
            ...defaultKeymap,
          ]),
          // 二期格式快捷键（Mod-B/I/K/1-6/Shift-C）
          markdownFormatKeymap(),
          tables({ onLinkClick: openLink }),
          imageBlocks({ resolve: resolveImage }),
          inlinePreview({ onLinkClick: openLink }),
          // 行内 $...$ 与 ```math 块级公式（KaTeX 渲染）
          mathPlugin,
          blockMathField,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString())
            }
          }),
        ],
      }),
    })
    viewRef.current = view

    // 粘贴图片拦截（同 CodeBlock 一期逻辑）
    const handlePaste = (e: ClipboardEvent) => {
      const cb = onPasteImageRef.current
      if (!cb) return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            cb(file)
            return
          }
        }
      }
    }
    view.dom.addEventListener('paste', handlePaste)

    return () => {
      view.dom.removeEventListener('paste', handlePaste)
      view.destroy()
      viewRef.current = null
      // 释放预取的 blob URL（记录切换/卸载时）
      for (const ref of blobMapRef.current.values()) {
        ref.revoke()
      }
      blobMapRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 图片 blob 预取：正文变化时增量补齐缺失的 att://（blob 就绪后强制重建 decorations）
  useEffect(() => {
    let cancelled = false
    const map = blobMapRef.current
    const missing = scanAttachmentRefs(value).filter((id) => !map.has(id))
    if (missing.length === 0) return
    void Promise.all(
      missing.map(async (id) => {
        const ref = await imageToBlobUrl(id)
        if (!ref) return
        // 正文再变/组件卸载（cancelled）时不可再入 map：立即释放，避免 URL 无 revoke 方
        if (cancelled) {
          ref.revoke()
        } else {
          map.set(id, ref)
        }
      })
    ).then(() => {
      if (cancelled) return
      const view = viewRef.current
      if (view) view.dispatch({ effects: imageBlocksRefreshEffect.of() })
    })
    return () => {
      cancelled = true
    }
  }, [value])

  // 外部 value 同步（父组件 key 已保证记录切换重建，此 effect 兜底外部写入）
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      })
    }
  }, [value])

  const handleClick = () => {
    viewRef.current?.focus()
  }

  // data-theme 必须放在 atomic-cm-editor 的祖先上（atomic CSS 用后代选择器
  // [data-theme="light"] .atomic-cm-editor），否则浅色变量组不生效 → 白底浅灰字
  return (
    <div data-theme={dark ? undefined : 'light'} className="h-full w-full">
      <div
        ref={containerRef}
        className="atomic-cm-editor h-full w-full"
        onClick={handleClick}
      />
    </div>
  )
})
