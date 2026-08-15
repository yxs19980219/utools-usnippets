/**
 * lib/atomic/image-blocks.ts —— 仿写 @atomic-editor/editor 的 imageBlocks（二期）
 *
 * 官方实现（dist/image-blocks.js）作模板，改造点：
 * 1. 增加 `resolve(src)` 配置项：att:// → blob URL 解析（一期 lib/attachment.ts 预取 Map）
 * 2. resolve 返回 null 时跳过 widget（回退源码显示，fedoup imageResolver 语义）；
 *    undefined 直通原 src（普通网络图）；string 用解析后的 src
 * 3. 自带 tree-progress 实现（官方内部模块未从包导出，无法深层 import）
 *
 * 说明：StateField 的 create/update 闭包在 imageBlocks() 调用时捕获 resolve，
 * 每编辑器实例独立（Extension 数组按 view 隔离）。
 */
import {
  ensureSyntaxTree,
  syntaxTree,
} from '@codemirror/language'
import { StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view'

/** 外部数据就绪（如 blob 预取完成）后强制重建图片 decorations */
export const imageBlocksRefreshEffect = StateEffect.define<void>()

export interface ImageBlocksConfig {
  /**
   * src 解析器：
   * - 返回 string：用解析后的 src 渲染
   * - 返回 null：跳过 widget（回退源码显示）
   * - 返回 undefined / 未配置：直通原始 src
   */
  resolve?: (src: string) => string | null | undefined
}

// 会话级自然尺寸缓存（key = 实际显示 src，blob URL 生命周期内稳定）
const dimensionCache = new Map<string, { w: number; h: number }>()

class ImageWidget extends WidgetType {
  constructor(
    private src: string,
    private alt: string
  ) {
    super()
  }

  eq(other: ImageWidget) {
    return other.src === this.src && other.alt === this.alt
  }

  toDOM(view: EditorView) {
    const wrap = document.createElement('div')
    wrap.className = 'cm-atomic-image'
    const img = document.createElement('img')
    img.src = this.src
    img.alt = this.alt
    img.loading = 'lazy'
    // 防 CM6 虚拟化重挂载抖动：缓存自然尺寸，先撑起盒子再加载
    const cached = dimensionCache.get(this.src)
    if (cached) {
      img.width = cached.w
      img.height = cached.h
    } else {
      img.addEventListener('load', () => {
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          dimensionCache.set(this.src, {
            w: img.naturalWidth,
            h: img.naturalHeight,
          })
        }
      })
    }
    wrap.appendChild(img)
    // 点击图片 → 光标回源行（源码行可编辑）
    const onPointer = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      const pos = view.posAtDOM(wrap)
      if (pos < 0) return
      const target = Math.max(0, pos - 1)
      view.focus()
      view.dispatch({
        selection: { anchor: target },
        scrollIntoView: false,
      })
    }
    wrap.addEventListener('mousedown', onPointer)
    return wrap
  }

  ignoreEvent(event: Event) {
    return event.type === 'mousedown' || event.type === 'click'
  }
}

function buildImageBlocks(
  state: Parameters<typeof ensureSyntaxTree>[0],
  resolve?: ImageBlocksConfig['resolve']
) {
  const ranges: { from: number; to: number; widget: ImageWidget }[] = []
  // 全文解析（200ms 预算），保证长文档底部图片也能 widget 化
  const tree =
    ensureSyntaxTree(state, state.doc.length, 200) ?? syntaxTree(state)
  tree.iterate({
    enter: (node) => {
      if (node.name !== 'Image') return
      // 表格内图片由表格 widget 自渲染，跳过避免双渲染
      for (let p = node.node.parent; p; p = p.parent) {
        if (p.name === 'Table') return
      }
      const raw = state.doc.sliceString(node.from, node.to)
      const match = raw.match(/^!\[([^\]]*)\]\(([^\s)"']+)(?:\s+["'][^)]*["'])?\)$/)
      if (!match) return
      const [, alt, src] = match
      if (!src) return
      const resolved = resolve?.(src)
      if (resolved === null) return // 解析失败 → 回退源码显示
      const displaySrc = resolved ?? src
      const line = state.doc.lineAt(node.from)
      ranges.push({
        from: line.to,
        to: line.to,
        widget: new ImageWidget(displaySrc, alt),
      })
    },
  })
  return Decoration.set(
    ranges.map((r) =>
      Decoration.widget({
        widget: r.widget,
        block: true,
        side: 1, // 图片渲染在源码行下方（Obsidian 模式）
      }).range(r.from, r.to)
    ),
    true
  )
}

/** 变更是否可能影响图片 widget（窄化失效：普通打字 O(change) 不 O(doc)） */
function changeAffectsImages(
  tr: { changes: import('@codemirror/state').ChangeSet; state: import('@codemirror/state').EditorState },
  existing: ReturnType<typeof Decoration.set>
) {
  let affected = false
  tr.changes.iterChanges((fromA, toA) => {
    if (affected) return
    existing.between(fromA, toA, () => {
      affected = true
      return false
    })
  })
  if (affected) return true
  const state = tr.state
  tr.changes.iterChanges((_fromA, _toA, fromB, toB) => {
    if (affected) return
    const startLine = state.doc.lineAt(fromB)
    const endLine = toB > startLine.to ? state.doc.lineAt(toB) : startLine
    for (let n = startLine.number; n <= endLine.number; n++) {
      if (state.doc.line(n).text.includes('![')) {
        affected = true
        break
      }
    }
  })
  return affected
}

// ---- tree-progress（官方内部模块自包含实现，逻辑等价）----
const treeGrowthEffect = StateEffect.define<void>()
const GROWTH_THRESHOLD = 8192
const TICK_BUDGET_MS = 30

function scheduleIdle(cb: () => void) {
  if (typeof window.requestIdleCallback === 'function') {
    return {
      kind: 'idle' as const,
      id: window.requestIdleCallback(() => cb()),
    }
  }
  return { kind: 'raf' as const, id: window.requestAnimationFrame(() => cb()) }
}

function cancelIdle(handle: { kind: 'idle' | 'raf'; id: number }) {
  if (
    handle.kind === 'idle' &&
    typeof window.cancelIdleCallback === 'function'
  ) {
    window.cancelIdleCallback(handle.id)
  } else if (handle.kind === 'raf') {
    window.cancelAnimationFrame(handle.id)
  }
}

/** 监控 lezer 后台解析进度，跨过阈值时派发 treeGrowthEffect 触发重建 */
const treeProgressPlugin = ViewPlugin.fromClass(
  class {
    private view: EditorView
    private lastTreeLen: number
    private idleHandle: { kind: 'idle' | 'raf'; id: number } | null = null
    private destroyed = false

    constructor(view: EditorView) {
      this.view = view
      this.lastTreeLen = syntaxTree(view.state).length
      this.schedule()
    }

    update(update: import('@codemirror/view').ViewUpdate) {
      if (update.docChanged) {
        this.lastTreeLen = syntaxTree(update.state).length
        this.schedule()
      }
    }

    destroy() {
      this.destroyed = true
      if (this.idleHandle !== null) {
        cancelIdle(this.idleHandle)
        this.idleHandle = null
      }
    }

    private schedule() {
      if (this.idleHandle !== null) return
      this.idleHandle = scheduleIdle(() => {
        this.idleHandle = null
        if (!this.destroyed) this.tick()
      })
    }

    private tick() {
      const state = this.view.state
      const docLen = state.doc.length
      if (this.lastTreeLen >= docLen) return
      const ensured = ensureSyntaxTree(state, docLen, TICK_BUDGET_MS)
      const newLen = (ensured ?? syntaxTree(state)).length
      if (
        newLen >= this.lastTreeLen + GROWTH_THRESHOLD ||
        newLen >= docLen
      ) {
        const previous = this.lastTreeLen
        this.lastTreeLen = newLen
        try {
          this.view.dispatch({ effects: treeGrowthEffect.of() })
        } catch {
          this.lastTreeLen = previous
          return
        }
      }
      if (newLen < docLen) this.schedule()
    }
  }
)

// ---- imageBlocks 主扩展 ----
export function imageBlocks(config: ImageBlocksConfig = {}): Extension {
  const { resolve } = config
  const imageBlocksField = StateField.define({
    create: (state) => buildImageBlocks(state, resolve),
    update(deco, tr) {
      for (const effect of tr.effects) {
        if (effect.is(treeGrowthEffect) || effect.is(imageBlocksRefreshEffect)) {
          return buildImageBlocks(tr.state, resolve)
        }
      }
      if (!tr.docChanged) return deco
      const mapped = deco.map(tr.changes)
      if (!changeAffectsImages(tr, deco)) return mapped
      return buildImageBlocks(tr.state, resolve)
    },
    provide: (f) => EditorView.decorations.from(f),
  })
  return [imageBlocksField, treeProgressPlugin]
}
