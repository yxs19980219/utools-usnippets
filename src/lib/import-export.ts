/**
 * lib/import-export.ts —— JSON 导入导出（design.md §5.7）
 *
 * 导出结构：{ app, version, exportedAt, categories, patterns, attachments }
 * - 附件从全部片段正文的 att:// 引用中枚举，取二进制转 base64
 * - 导入为"合并"语义：记录/分类 id 冲突时生成新 id；附件 id 已存在时跳过
 *   （附件不可覆盖更新）
 */
import type { Category, PatternRecord } from '../types'
import { CATEGORY_PREFIX, PATTERN_PREFIX } from '../types'
import { uuid } from './uuid'
import {
  getAttachment,
  getAttachmentType,
  loadCategories,
  loadPatterns,
  openTextFile,
  putAttachmentById,
  saveTextFile,
  saveCategory,
  savePattern,
  writeUserDataFile,
} from './db'
import { scanAttachmentRefs } from './attachment'

export interface ExportFile {
  app: 'pattern-vault'
  version: 1
  exportedAt: number
  categories: Category[]
  patterns: PatternRecord[]
  attachments: Array<{ id: string; mime: string; data: string }>
}

const EXPORT_VERSION = 1

function base64FromBytes(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function bytesFromBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// ---------------------------------------------------------------------------
// 导出
// ---------------------------------------------------------------------------

async function collectAttachments(patterns: PatternRecord[]) {
  const seen = new Set<string>()
  const attachments: ExportFile['attachments'] = []
  for (const p of patterns) {
    for (const f of p.fragments) {
      for (const attId of scanAttachmentRefs(f.content)) {
        if (seen.has(attId)) continue
        seen.add(attId)
        const data = await getAttachment(attId)
        if (!data) continue
        const mime = (await getAttachmentType(attId)) || 'application/octet-stream'
        attachments.push({ id: attId, mime, data: base64FromBytes(data) })
      }
    }
  }
  return attachments
}

export async function exportAllToFile(): Promise<string | null> {
  const [categories, patterns] = await Promise.all([
    loadCategories(),
    loadPatterns(),
  ])
  const attachments = await collectAttachments(patterns)

  const payload: ExportFile = {
    app: 'pattern-vault',
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    categories,
    patterns,
    attachments,
  }

  return saveTextFile(
    {
      title: '导出模式库',
      defaultPath: `pattern-vault-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    },
    JSON.stringify(payload, null, 2)
  )
}

// ---------------------------------------------------------------------------
// 导入
// ---------------------------------------------------------------------------

function isExportFile(v: unknown): v is ExportFile {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    o.app === 'pattern-vault' &&
    o.version === EXPORT_VERSION &&
    Array.isArray(o.categories) &&
    Array.isArray(o.patterns) &&
    Array.isArray(o.attachments)
  )
}

/** 导入（合并语义）：返回导入统计；导入前备份现有库到 userData */
export async function importFromFile(): Promise<{
  patterns: number
  categories: number
  attachments: number
} | null> {
  const content = openTextFile({
    title: '导入模式库',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (content === null) return null

  let payload: unknown
  try {
    payload = JSON.parse(content)
  } catch {
    throw new Error('文件不是有效的 JSON')
  }
  if (!isExportFile(payload)) {
    throw new Error('文件结构不匹配（app/version/字段校验失败）')
  }

  // 备份现有库（静默写入 userData 临时文件，失败不阻塞导入）
  try {
    const [cats, pats] = await Promise.all([loadCategories(), loadPatterns()])
    const atts = await collectAttachments(pats)
    const backup: ExportFile = {
      app: 'pattern-vault',
      version: EXPORT_VERSION,
      exportedAt: Date.now(),
      categories: cats,
      patterns: pats,
      attachments: atts,
    }
    writeUserDataFile(
      `pattern-vault-backup-${Date.now()}.json`,
      JSON.stringify(backup, null, 2)
    )
  } catch {
    // 备份失败不阻塞
  }

  // 已存在的 id（合并语义：冲突生成新 id，避免覆盖现有数据）
  const [existingPatterns, existingCategories] = await Promise.all([
    loadPatterns(),
    loadCategories(),
  ])
  const patternIds = new Set(existingPatterns.map((p) => p._id))
  const categoryIds = new Set(existingCategories.map((c) => c._id))

  let categoriesImported = 0
  for (const c of payload.categories) {
    const doc: Category = { ...c }
    if (categoryIds.has(doc._id)) {
      doc._id = `${CATEGORY_PREFIX}${uuid()}`
    }
    if (await saveCategory(doc)) categoriesImported++
  }

  let patternsImported = 0
  for (const p of payload.patterns) {
    const doc: PatternRecord = { ...p }
    if (patternIds.has(doc._id)) {
      doc._id = `${PATTERN_PREFIX}${uuid()}`
    }
    if (await savePattern(doc)) patternsImported++
  }

  let attachmentsImported = 0
  for (const a of payload.attachments) {
    const ok = await putAttachmentById(a.id, bytesFromBase64(a.data), a.mime)
    if (ok) attachmentsImported++
    // 附件 id 已存在（不可覆盖）→ 跳过，正文引用仍指向旧附件
  }

  return {
    patterns: patternsImported,
    categories: categoriesImported,
    attachments: attachmentsImported,
  }
}
