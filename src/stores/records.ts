/**
 * stores/records.ts —— 记录管理 + 自动保存（design.md §5.3）
 *
 * 自动保存：内容变更 → 内存更新 → 防抖 1s → flush 写库
 * - 保存状态：idle（未改动）| saving（有待存修改）| saved（已保存✓）| error
 * - 写库串行化（promise 链），避免异步 put 乱序覆盖
 * - 删除记录时一并删除其正文引用的附件（避免孤儿附件）
 */
import { create } from 'zustand'
import type { PatternRecord } from '../types'
import { PATTERN_PREFIX } from '../types'
import { uuid } from '../lib/uuid'
import {
  deletePattern,
  loadPatterns,
  putImageAttachment,
  removeAttachment,
  savePattern,
} from '../lib/db'
import { scanAttachmentRefs } from '../lib/attachment'
import { useSettings } from './settings'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface RecordsState {
  records: PatternRecord[]
  loaded: boolean
  saveState: SaveState
  load: () => Promise<void>
  /** 新建空白记录（默认一个 js 片段），落库后返回（调用方负责选中） */
  createRecord: () => Promise<PatternRecord | null>
  /** 内存更新 + 防抖 1s 落库 */
  updateRecord: (id: string, patch: Partial<PatternRecord>) => void
  /** 立即落库（组件卸载/窗口关闭前调用） */
  flushSave: () => Promise<void>
  /** 移入回收站（软删除，立即落库） */
  moveToTrash: (id: string) => Promise<void>
  /** 从回收站恢复 */
  restoreFromTrash: (id: string) => Promise<void>
  /** 回收站内彻底删除（物理删除 + 附件清理） */
  deleteForever: (id: string) => Promise<void>
  /** 收藏/取消收藏（立即落库） */
  toggleFavorite: (id: string) => Promise<void>
  /** 移动记录到分类（即时落库，不防抖） */
  moveRecord: (id: string, categoryId: string | null) => Promise<void>
  /** 删除分类时，将其下记录全部置为未分类 */
  moveCategoryToUncategorized: (categoryId: string) => Promise<void>
  /** 粘贴图片：附件落库 → 返回 markdown 引用（先附件后正文） */
  attachImage: (
    patternId: string,
    data: Uint8Array | ArrayBuffer,
    mime: string
  ) => Promise<string | null>
}

// 防抖与写库队列（模块级，跨 store 实例）
let saveTimer: ReturnType<typeof setTimeout> | null = null
// 待保存记录集合：防抖窗口内可能切换多条记录（如 A 编辑后立即切 B），
// flush 时必须全部落库，不能只存最后一条
const pendingIds = new Set<string>()
let saveChain: Promise<unknown> = Promise.resolve()

function enqueue(fn: () => Promise<unknown>) {
  saveChain = saveChain.then(fn).catch(() => {})
  return saveChain
}

export const useRecords = create<RecordsState>((set, get) => ({
  records: [],
  loaded: false,
  saveState: 'idle',

  load: async () => {
    const records = await loadPatterns()
    // 归一化：旧数据可能缺少 favorite/deleted 字段
    for (const r of records) {
      if (r.favorite === undefined) r.favorite = false
      if (r.deleted === undefined) r.deleted = false
    }
    records.sort((a, b) => b.updatedAt - a.updatedAt)
    set({ records, loaded: true, saveState: 'idle' })
  },

  createRecord: async () => {
    const now = Date.now()
    const defaultLanguage =
      useSettings.getState().defaultLanguage || 'javascript'
    const record: PatternRecord = {
      _id: `${PATTERN_PREFIX}${uuid()}`,
      title: '',
      scenario: '',
      fragments: [{ id: uuid(), language: defaultLanguage, content: '' }],
      categoryId: null,
      tags: [],
      favorite: false,
      deleted: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    }
    const ok = await enqueue(() => savePattern(record))
    if (!ok) return null
    set({
      records: [record, ...get().records],
      saveState: 'saved',
    })
    return record
  },

  updateRecord: (id, patch) => {
    const { records } = get()
    const record = records.find((r) => r._id === id)
    if (!record) return

    Object.assign(record, patch, { updatedAt: Date.now() })
    set({ records: [...records], saveState: 'saving' })

    // 防抖 1s
    pendingIds.add(id)
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      void get().flushSave()
    }, 1000)
  },

  flushSave: async () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    const ids = [...pendingIds]
    pendingIds.clear()
    if (ids.length === 0) return

    const { records } = get()
    let allOk = true
    for (const id of ids) {
      const record = records.find((r) => r._id === id)
      if (!record) continue
      const ok = await enqueue(() => savePattern(record))
      if (!ok) allOk = false
    }
    set({ saveState: allOk ? 'saved' : 'error' })
  },

  /** 移入回收站：软删除（立即落库） */
  moveToTrash: async (id) => {
    pendingIds.delete(id)
    const { records } = get()
    const record = records.find((r) => r._id === id)
    if (!record) return
    record.deleted = true
    record.updatedAt = Date.now()
    set({ records: [...records] })
    await enqueue(() => savePattern(record))
  },

  restoreFromTrash: async (id) => {
    const { records } = get()
    const record = records.find((r) => r._id === id)
    if (!record) return
    record.deleted = false
    record.updatedAt = Date.now()
    set({ records: [...records] })
    await enqueue(() => savePattern(record))
  },

  deleteForever: async (id) => {
    // 取消挂起的自动保存
    pendingIds.delete(id)
    if (saveTimer && pendingIds.size === 0) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    const { records } = get()
    const record = records.find((r) => r._id === id)
    set({ records: records.filter((r) => r._id !== id) })

    // 删除其正文引用的附件（孤儿清理，失败不阻塞删除）
    if (record) {
      for (const f of record.fragments) {
        for (const attId of scanAttachmentRefs(f.content)) {
          await enqueue(() => removeAttachment(attId)).catch(() => {})
        }
      }
    }
    await enqueue(() => deletePattern(id))
  },

  toggleFavorite: async (id) => {
    const { records } = get()
    const record = records.find((r) => r._id === id)
    if (!record) return
    record.favorite = !record.favorite
    record.updatedAt = Date.now()
    set({ records: [...records] })
    await enqueue(() => savePattern(record))
  },

  moveRecord: async (id, categoryId) => {
    const { records } = get()
    const record = records.find((r) => r._id === id)
    if (!record) return
    record.categoryId = categoryId
    record.updatedAt = Date.now()
    set({ records: [...records] })
    await enqueue(() => savePattern(record))
  },

  moveCategoryToUncategorized: async (categoryId) => {
    const { records } = get()
    const affected = records.filter((r) => r.categoryId === categoryId)
    if (affected.length === 0) return
    for (const r of affected) {
      r.categoryId = null
      r.updatedAt = Date.now()
    }
    set({ records: [...records] })
    await enqueue(() =>
      Promise.all(affected.map((r) => savePattern(r)))
    )
  },

  attachImage: async (patternId, data, mime) => {
    // 附件 ≤10M 由 preload/utools 校验；此处做一次前置拦截
    if (data.byteLength > 10 * 1024 * 1024) {
      return null
    }
    const result = await putImageAttachment(patternId, data, mime)
    return result ? result.markdown : null
  },
}))
