/**
 * lib/attachment.ts —— att:// 引用解析
 * 一期：解析引用 id（粘贴图片落库后插入源码引用，就地渲染留二期）；
 * 二期渲染层直接复用 imageToBlobUrl。
 */
import { getAttachment, getAttachmentType } from './db'
import { ATT_REF_RE } from '../types'

/** att://<id> → <id>，非附件引用返回 null */
export function resolveAttRef(ref: string): string | null {
  const m = ref.match(/^att:\/\/(.+)$/)
  return m ? m[1] : null
}

/** 扫描正文，返回所有附件引用 id（去重） */
export function scanAttachmentRefs(content: string): string[] {
  const ids = new Set<string>()
  for (const m of content.matchAll(ATT_REF_RE)) {
    const id = resolveAttRef(m[1])
    if (id) ids.add(id)
  }
  return [...ids]
}

/**
 * 附件 id → blob URL（二期就地渲染用，一期预留实现）
 * 调用方负责 URL.revokeObjectURL
 */
export async function imageToBlobUrl(
  attId: string
): Promise<string | null> {
  const data = await getAttachment(attId)
  if (!data) return null
  const type = (await getAttachmentType(attId)) || 'image/png'
  const blob = new Blob([data as unknown as BlobPart], { type })
  return URL.createObjectURL(blob)
}
