/**
 * lib/search.ts —— 纯函数过滤（标题/场景/标签/正文全文，小写 includes）
 * 记录级：filterPatterns（主界面列表）；片段级：buildSnippetEntries/filterSnippets（搜索视图）
 */
import type { PatternRecord } from '../types'
import { UNCATEGORIZED, isNote } from '../types'

/** 片段搜索视图的列表条目（一个代码片段 = 一条） */
export interface SnippetEntry {
  recordId: string
  recordTitle: string
  recordScenario: string
  recordTags: string[]
  /** 所属分类 id（null = 未分类），展示所属文件夹 */
  categoryId: string | null
  fragmentId: string
  /** 片段在记录内的下标（组内排序，展示"片段 N"） */
  fragmentIndex: number
  /** Fragment.name ?? `片段 ${index+1}` */
  name: string
  language: string
  content: string
  /** 是否为所属记录的组首（组首显示完整标题，其余缩进） */
  groupStart: boolean
}

/**
 * 片段条目化（搜索视图数据源）：排除回收站记录与笔记（isNote，全 markdown），
 * 再过滤掉记录内 markdown 片段，按「记录序 → 片片段序」展平 → 同记录天然相邻归组。
 * 记录内首个非 markdown 片段标记 groupStart。
 */
export function buildSnippetEntries(records: PatternRecord[]): SnippetEntry[] {
  const entries: SnippetEntry[] = []
  for (const record of records) {
    if (record.deleted || isNote(record)) continue
    let groupStart = true
    record.fragments.forEach((fragment, index) => {
      if (fragment.language === 'markdown') return
      entries.push({
        recordId: record._id,
        recordTitle: record.title,
        recordScenario: record.scenario,
        recordTags: record.tags,
        categoryId: record.categoryId,
        fragmentId: fragment.id,
        fragmentIndex: index,
        name: fragment.name ?? `片段 ${index + 1}`,
        language: fragment.language,
        content: fragment.content,
        groupStart,
      })
      groupStart = false
    })
  }
  return entries
}

/** 片段级过滤：content / 标题 / 场景 / 标签 小写 includes；query 为空 → 全量 */
export function filterSnippets(
  entries: SnippetEntry[],
  query: string
): SnippetEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return entries
  return entries.filter((e) => {
    if (e.content.toLowerCase().includes(q)) return true
    if (e.recordTitle.toLowerCase().includes(q)) return true
    if (e.recordScenario.toLowerCase().includes(q)) return true
    if (e.recordTags.some((t) => t.toLowerCase().includes(q))) return true
    return false
  })
}

/** 片段内容预览：去掉开头空行，取前 3 行拼接（搜索视图/主搜索框结果用） */
export function previewSnippet(content: string): string {
  const lines = content.split('\n')
  let start = 0
  while (start < lines.length && lines[start].trim() === '') start++
  return lines.slice(start, start + 3).join('\n')
}

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
