/**
 * lib/icons.ts —— 记录 → 类型图标/语言徽标推断
 */
import type { PatternRecord } from '../types'
import { isNote } from '../types'
import { languageLabel } from './languages'

export interface ListMeta {
  isNote: boolean
  /** 主语言（首个非 markdown 片段；全 markdown 取首个片段语言 = markdown） */
  primaryLanguage: string
  /** 语言徽标文本（全 markdown 显示"笔记"；否则显示主语言） */
  badge: string
}

export function listMeta(record: PatternRecord): ListMeta {
  const note = isNote(record)
  const primary = record.fragments[0]?.language ?? 'plaintext'
  return {
    isNote: note,
    primaryLanguage: primary,
    badge: note ? '笔记' : languageLabel(primary),
  }
}
