/**
 * lib/search.ts —— 纯函数过滤（标题/场景/标签/正文全文，小写 includes）
 */
import type { PatternRecord } from '../types'
import { UNCATEGORIZED } from '../types'

export interface FilterOptions {
  /** 搜索词（标题/场景/标签/正文全文命中） */
  query?: string
  /** 分类筛选：null = 全部；UNCATEGORIZED = 未分类；否则为分类 id */
  categoryId?: string | null
  /** 标签筛选 */
  tag?: string | null
}

export function filterPatterns(
  records: PatternRecord[],
  options: FilterOptions
): PatternRecord[] {
  const q = (options.query ?? '').trim().toLowerCase()

  return records.filter((r) => {
    if (options.categoryId === UNCATEGORIZED) {
      if (r.categoryId !== null) return false
    } else if (options.categoryId !== null && options.categoryId !== undefined) {
      if (r.categoryId !== options.categoryId) return false
    }

    if (options.tag && !r.tags.includes(options.tag)) return false

    if (q) {
      const inTitle = r.title.toLowerCase().includes(q)
      const inScenario = r.scenario.toLowerCase().includes(q)
      const inTags = r.tags.some((t) => t.toLowerCase().includes(q))
      const inBody = r.fragments.some((f) =>
        f.content.toLowerCase().includes(q)
      )
      if (!inTitle && !inScenario && !inTags && !inBody) return false
    }

    return true
  })
}

/** 列表排序：最近修改优先 */
export function sortByRecent(records: PatternRecord[]): PatternRecord[] {
  return [...records].sort((a, b) => b.updatedAt - a.updatedAt)
}

/** 标签云：全库扫描去重计数 */
export function tagCloud(
  records: PatternRecord[]
): Array<{ tag: string; count: number }> {
  const map = new Map<string, number>()
  for (const r of records) {
    for (const t of r.tags) {
      map.set(t, (map.get(t) ?? 0) + 1)
    }
  }
  return [...map.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}
