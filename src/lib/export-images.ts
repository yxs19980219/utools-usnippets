/**
 * lib/export-images.ts —— 导出记录内全部图片附件（右键菜单）
 * 逐个弹保存对话框，用户取消即停止；无附件返回 0。
 */
import type { PatternRecord } from '@/types'
import {
  getAttachment,
  getAttachmentType,
  saveBinaryFile,
} from './db'
import { scanAttachmentRefs } from './attachment'

function extFromMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpg'
    case 'image/gif':
      return 'gif'
    case 'image/webp':
      return 'webp'
    case 'image/svg+xml':
      return 'svg'
    case 'image/bmp':
      return 'bmp'
    case 'image/avif':
      return 'avif'
    default:
      return 'img'
  }
}

export async function exportRecordImages(
  record: PatternRecord
): Promise<number | null> {
  const attIds: string[] = []
  for (const f of record.fragments) {
    for (const id of scanAttachmentRefs(f.content)) {
      if (!attIds.includes(id)) attIds.push(id)
    }
  }
  if (attIds.length === 0) return 0

  let exported = 0
  for (const id of attIds) {
    const data = await getAttachment(id)
    if (!data) continue
    const mime = (await getAttachmentType(id)) || 'image/png'
    const ext = extFromMime(mime)
    const saved = saveBinaryFile(
      {
        title: '导出图片',
        defaultPath: `image-${exported + 1}.${ext}`,
        filters: [{ name: '图片', extensions: [ext] }],
      },
      data
    )
    if (saved === null) break // 用户取消
    exported++
  }
  return exported
}
