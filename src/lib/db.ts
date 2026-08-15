/**
 * lib/db.ts —— 数据服务层（唯一数据入口）
 *
 * 边界约定（design.md §1）：
 * - 渲染进程一律经本模块访问数据，不直接调 window.services 散落调用
 * - 底层为 preload/services.js 暴露的 window.services（db / attachment / file）
 *
 * utools.db 只存用户主动创建的内容（记录/分类/附件），合规红线。
 */
import type { Category, PatternRecord } from '../types'
import { CATEGORY_PREFIX, PATTERN_PREFIX } from '../types'

const svc = () => window.services

// ---------------------------------------------------------------------------
// 记录（pattern/<uuid>）
// ---------------------------------------------------------------------------

export async function loadPatterns(): Promise<PatternRecord[]> {
  try {
    const docs = await svc().db.allDocs(PATTERN_PREFIX)
    // 附件文档可能以 pattern/ 开头（如 pattern/<id>/img-<ts>），用 title 字段区分
    return docs
      .filter((d) => typeof d.title === 'string')
      .map((d) => d as unknown as PatternRecord)
  } catch {
    return []
  }
}

/** 保存记录（更新时带 _rev，成功后回写最新 rev；异常/失败返回 false） */
export async function savePattern(record: PatternRecord): Promise<boolean> {
  try {
    const result = await svc().db.put({ ...record })
    if (result.ok && result.rev) {
      record._rev = result.rev
    }
    return !!result.ok
  } catch {
    return false
  }
}

export async function deletePattern(_id: string): Promise<boolean> {
  try {
    const result = await svc().db.remove(_id)
    return !!result.ok
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// 分类（category/<uuid>）
// ---------------------------------------------------------------------------

export async function loadCategories(): Promise<Category[]> {
  try {
    const docs = await svc().db.allDocs(CATEGORY_PREFIX)
    return docs
      .filter((d) => typeof d.name === 'string')
      .map((d) => d as unknown as Category)
  } catch {
    return []
  }
}

export async function saveCategory(category: Category): Promise<boolean> {
  try {
    const result = await svc().db.put({ ...category })
    if (result.ok && result.rev) {
      category._rev = result.rev
    }
    return !!result.ok
  } catch {
    return false
  }
}

export async function deleteCategory(_id: string): Promise<boolean> {
  try {
    const result = await svc().db.remove(_id)
    return !!result.ok
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// 附件（图片 ≤10M，只能创建不能更新）
// ---------------------------------------------------------------------------

export interface AttachResult {
  /** 附件文档 id，如 pattern/<patternId>/img-<ts> */
  id: string
  /** 可直接插入正文的 markdown 引用：![](att://<id>) */
  markdown: string
}

export async function putImageAttachment(
  patternId: string,
  data: Uint8Array | ArrayBuffer,
  mime: string
): Promise<AttachResult | null> {
  // patternId 为完整记录 _id（pattern/<uuid>），附件 id 按 design §2 规则：
  // pattern/<patternId>/img-<ts>（重命名记录不影响附件）
  const id = `${patternId}/img-${Date.now()}`
  const result = await svc().attachment.put(id, data, mime)
  if (!result.ok) return null
  return { id, markdown: `![](att://${id})` }
}

export function getAttachment(id: string): Promise<Uint8Array | null> {
  return svc().attachment.get(id)
}

export function getAttachmentType(id: string): Promise<string> {
  return svc().attachment.getType(id)
}

/** 删除附件（替换图片 = 删旧建新，附件不可覆盖更新） */
export async function removeAttachment(id: string): Promise<boolean> {
  try {
    const result = await svc().attachment.remove(id)
    return !!result.ok
  } catch {
    return false
  }
}

/** 按指定 id 落附件（导入还原用，id 已存在时失败） */
export async function putAttachmentById(
  id: string,
  data: Uint8Array | ArrayBuffer,
  mime: string
): Promise<boolean> {
  try {
    const result = await svc().attachment.put(id, data, mime)
    return !!result.ok
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// 文件（导入/导出 JSON）
// ---------------------------------------------------------------------------

export function openTextFile(
  options: Record<string, unknown>
): string | null {
  return svc().file.openTextFile(options)
}

export function saveTextFile(
  options: Record<string, unknown>,
  content: string
): string | null {
  return svc().file.saveTextFile(options, content)
}

/** 弹出保存文件对话框，写入二进制内容（导出图片用） */
export function saveBinaryFile(
  options: Record<string, unknown>,
  data: Uint8Array | ArrayBuffer
): string | null {
  return svc().file.saveBinaryFile(options, data)
}

/** 静默写入 userData 目录（导入前备份用，仅允许 basename） */
export function writeUserDataFile(
  filename: string,
  content: string
): string | null {
  return svc().file.writeUserDataFile(filename, content)
}

// ---------------------------------------------------------------------------
// 生命周期（preload 不可用时的降级提示）
// ---------------------------------------------------------------------------

export function servicesReady(): boolean {
  return typeof window !== 'undefined' && !!window.services
}
