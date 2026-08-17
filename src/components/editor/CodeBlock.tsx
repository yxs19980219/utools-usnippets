/**
 * components/editor/CodeBlock.tsx —— CodeMirror 6 封装（design.md §5.1）
 *
 * 二期边界：markdown 语言替换 atomic 只动本组件内部；
 * 对外接口保持 value / onChange / language / onPasteImage。
 *
 * - 语言包按需注册（js/ts/jsx/tsx 由 @codemirror/lang-javascript 覆盖）
 * - 粘贴图片：仅当 onPasteImage 回调存在时拦截（父组件只在 markdown tab 传入）
 * - 深色主题随 dark 切换（oneDark / 默认浅色）
 */
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  forwardRef,
} from 'react'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands'
import {
  defaultHighlightStyle,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'
import { sql } from '@codemirror/lang-sql'
import { python } from '@codemirror/lang-python'
import { php } from '@codemirror/lang-php'
import { StreamLanguage } from '@codemirror/language'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { go } from '@codemirror/legacy-modes/mode/go'
import { rust } from '@codemirror/legacy-modes/mode/rust'
import { ruby } from '@codemirror/legacy-modes/mode/ruby'
import { yaml } from '@codemirror/legacy-modes/mode/yaml'
import { c, cpp, java } from '@codemirror/legacy-modes/mode/clike'
import { oneDark } from '@codemirror/theme-one-dark'

export interface CodeBlockProps {
  value: string
  onChange: (value: string) => void
  language: string
  dark: boolean
  /** 仅 markdown 语言 tab 由父组件传入（粘贴图片 → 附件） */
  onPasteImage?: (file: File) => void
}

function languageExtension(language: string) {
  switch (language) {
    case 'javascript':
      return [javascript()]
    case 'typescript':
      return [javascript({ typescript: true })]
    case 'jsx':
      return [javascript({ jsx: true })]
    case 'tsx':
      return [javascript({ jsx: true, typescript: true })]
    case 'html':
      return [html()]
    case 'css':
      return [css()]
    case 'json':
      return [json()]
    case 'sql':
      return [sql()]
    case 'python':
      return [python()]
    case 'java':
      return [StreamLanguage.define(java)]
    case 'c':
      return [StreamLanguage.define(c)]
    case 'cpp':
      return [StreamLanguage.define(cpp)]
    case 'go':
      return [StreamLanguage.define(go)]
    case 'rust':
      return [StreamLanguage.define(rust)]
    case 'php':
      return [php()]
    case 'ruby':
      return [StreamLanguage.define(ruby)]
    case 'yaml':
      return [StreamLanguage.define(yaml)]
    case 'markdown':
      return [markdown()]
    case 'shell':
      return [StreamLanguage.define(shell)]
    default:
      return []
  }
}

function themeExtension(dark: boolean) {
  const base = EditorView.theme(
    {
      '&': { backgroundColor: 'transparent' },
      '.cm-activeLine': { backgroundColor: 'transparent' },
      '.cm-activeLineGutter': { backgroundColor: 'transparent' },
      // 选中背景需与 CM base theme 同深度选择器（&light/&dark 5 类），
      // 否则深色下被 oneDark #3E4451（与背景同色）压过
      '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground':
        {
          backgroundColor: dark
            ? 'rgba(94, 129, 244, 0.35)'
            : 'rgba(94, 129, 244, 0.22)',
        },
    },
    { dark }
  )
  return dark ? [oneDark, base] : [syntaxHighlighting(defaultHighlightStyle), base]
}

export interface CodeBlockHandle {
  /** 在光标处插入文本（图片粘贴用） */
  insert: (text: string) => void
  focus: () => void
}

export const CodeBlock = forwardRef<CodeBlockHandle, CodeBlockProps>(
  function CodeBlock(
    { value, onChange, language, dark, onPasteImage },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const onChangeRef = useRef(onChange)
    const onPasteImageRef = useRef(onPasteImage)
    const languageCompartment = useRef(new Compartment())
    const themeCompartment = useRef(new Compartment())

    onChangeRef.current = onChange
    onPasteImageRef.current = onPasteImage

    useImperativeHandle(ref, () => ({
      insert(text) {
        const view = viewRef.current
        if (!view) return
        view.dispatch({
          changes: {
            from: view.state.selection.main.head,
            insert: text,
          },
        })
        view.focus()
      },
      focus() {
        viewRef.current?.focus()
      },
    }))

  // 初始化（仅一次）
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          indentUnit.of('  '),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            indentWithTab,
          ]),
          highlightSelectionMatches(),
          languageCompartment.current.of(languageExtension(language)),
          themeCompartment.current.of(themeExtension(dark)),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString())
            }
          }),
        ],
      }),
      parent: el,
    })
    viewRef.current = view

    // 粘贴图片拦截（仅 markdown tab：父组件传入回调时启用）
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 外部 value 同步（切换记录时），避免覆盖用户输入
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

  // 语言切换（compartment 重建语言扩展，不重建 view）
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: languageCompartment.current.reconfigure(
        languageExtension(language)
      ),
    })
  }, [language])

  // 深色主题切换
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: themeCompartment.current.reconfigure(themeExtension(dark)),
    })
  }, [dark])

  const handleClick = useCallback(() => {
    viewRef.current?.focus()
  }, [])

  return <div ref={containerRef} className="h-full w-full" onClick={handleClick} />
  }
)
