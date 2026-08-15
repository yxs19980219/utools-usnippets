/**
 * lib/clipboard.ts —— 复制能力（uTools copyText 优先，clipboard API 兜底）
 */
export function copyText(text: string): boolean {
  try {
    if (window.utools?.copyText) {
      return window.utools.copyText(text)
    }
  } catch {
    // 降级到浏览器剪贴板 API
  }
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // ignore
  }
  return false
}
