/**
 * lib/atomic/markdown-format.ts —— markdown 格式快捷键（仅 MarkdownEditor 挂载）
 *
 * @codemirror/lang-markdown 的 markdownKeymap 只含 Enter/Backspace，
 * 格式命令（粗体/斜体/链接/标题/代码块）需自实现。只挂在 markdown
 * 编辑器上，不影响其他语言（CodeBlock 不挂此 keymap）。
 */
import { keymap, type Command } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

/** 行内标记 toggle：有选区且已包裹 → 去包；否则包裹（无选区插入占位并选中） */
function toggleInlineMark(marker: string, placeholder: string): Command {
  return (view) => {
    const { state } = view
    const { from, to } = state.selection.main
    const doc = state.doc

    if (from === to) {
      const text = `${marker}${placeholder}${marker}`
      view.dispatch({
        changes: { from, insert: text },
        selection: { anchor: from + marker.length, head: from + marker.length + placeholder.length },
        scrollIntoView: true,
      })
      return true
    }

    const pre = doc.sliceString(Math.max(0, from - marker.length), from)
    const post = doc.sliceString(to, Math.min(doc.length, to + marker.length))
    if (pre === marker && post === marker) {
      view.dispatch({
        changes: [
          { from: from - marker.length, to: from, insert: '' },
          { from: to - marker.length, to: to + marker.length, insert: '' },
        ],
        selection: { anchor: from - marker.length, head: to - marker.length },
      })
    } else {
      view.dispatch({
        changes: [
          { from: to, insert: marker },
          { from, insert: marker },
        ],
        selection: { anchor: from + marker.length, head: to + marker.length },
      })
    }
    return true
  }
}

/** 标题 toggle：行首已是 #n → 移除；否则设为 n 级（保留行首缩进） */
function setHeading(level: number): Command {
  return (view) => {
    const { state } = view
    const sel = state.selection.main
    const line = state.doc.lineAt(sel.from)
    const indent = line.text.match(/^(\s*)/)?.[1] ?? ''
    const m = line.text.match(/^(#{1,6})\s(.*)$/)

    if (m && m[1].length === level) {
      // 已是该级标题 → 降为正文
      const newStart = line.from + indent.length
      view.dispatch({
        changes: {
          from: newStart,
          to: newStart + m[1].length + 1,
          insert: '',
        },
      })
    } else {
      const content = m ? m[2] : line.text.slice(indent.length)
      const insertAt = line.from + indent.length
      view.dispatch({
        changes: {
          from: insertAt,
          to: line.to,
          insert: `${'#'.repeat(level)} ${content}`,
        },
        selection: { anchor: insertAt + level + 1 + sel.from - line.from - indent.length },
      })
    }
    return true
  }
}

/** 代码块 toggle：选区/所在行包裹 ``` fence；已是 fence 则去包 */
const toggleCodeBlock: Command = (view) => {
  const { state } = view
  const sel = state.selection.main
  const lineFrom = state.doc.lineAt(sel.from).from
  const lineTo = state.doc.lineAt(sel.to).to
  const text = state.doc.sliceString(lineFrom, lineTo)
  const lines = text.split('\n')
  const first = lines[0]?.trim()
  const last = lines[lines.length - 1]?.trim()

  if (first === '```' && last === '```') {
    view.dispatch({
      changes: { from: lineFrom, to: lineTo, insert: lines.slice(1, -1).join('\n') },
    })
  } else {
    view.dispatch({
      changes: [
        { from: lineFrom, insert: '```\n' },
        { from: lineTo, insert: '\n```' },
      ],
    })
  }
  return true
}

/** 链接 toggle：选区包 [text](url)（光标定位 url）；已是 [..] 去包；无选区插入空链接 */
const toggleLink: Command = (view) => {
  const { state } = view
  const { from, to } = state.selection.main
  const selected = state.doc.sliceString(from, to)

  if (from === to) {
    view.dispatch({
      changes: { from, insert: '[](url)' },
      selection: { anchor: from + 1, head: from + 1 },
    })
    return true
  }

  if (selected.startsWith('[') && selected.endsWith(']')) {
    view.dispatch({
      changes: { from, to, insert: selected.slice(1, -1) },
      selection: { anchor: from, head: from + selected.length - 2 },
    })
    return true
  }

  view.dispatch({
    changes: { from, to, insert: `[${selected}](url)` },
    selection: { anchor: from + selected.length + 3, head: from + selected.length + 3 },
  })
  return true
}

/** 挂载进 MarkdownEditor 的格式快捷键 */
export function markdownFormatKeymap(): Extension {
  return keymap.of([
    { key: 'Mod-b', run: toggleInlineMark('**', '粗体') },
    { key: 'Mod-i', run: toggleInlineMark('*', '斜体') },
    { key: 'Mod-k', run: toggleLink },
    { key: 'Mod-1', run: setHeading(1) },
    { key: 'Mod-2', run: setHeading(2) },
    { key: 'Mod-3', run: setHeading(3) },
    { key: 'Mod-4', run: setHeading(4) },
    { key: 'Mod-5', run: setHeading(5) },
    { key: 'Mod-6', run: setHeading(6) },
    { key: 'Mod-Shift-c', run: toggleCodeBlock },
  ])
}
