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
 * 附件 blob URL + 生命周期（revoke 与 create 同源，避免 URL 泄漏）
 * 调用方持有 ref，用完（组件卸载/替换）调 ref.revoke()
 */
export interface BlobUrlRef {
  url: string
  revoke: () => void
}

/**
 * 附件 id → blob URL（二期就地渲染用，一期预留实现）
 * 返回带 revoke 的引用对象；调用方负责在不再需要时调用 revoke()
 */
export async function imageToBlobUrl(
  attId: string
): Promise<BlobUrlRef | null> {
  const data = await getAttachment(attId)
  if (!data) return null
  const type = (await getAttachmentType(attId)) || 'image/png'
  const blob = new Blob([data as unknown as BlobPart], { type })
  const url = URL.createObjectURL(blob)
  return {
    url,
    revoke: () => URL.revokeObjectURL(url),
  }
}
