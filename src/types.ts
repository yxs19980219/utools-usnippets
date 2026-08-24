/**
 * 领域类型 —— Pattern Vault 数据模型（design.md §2）
 * 记录/分类存 utools.db 文档；图片存附件，正文以 ![](att://<id>) 引用。
 */

export interface Fragment {
  id: string
  language: string
  content: string
  /** 片段自定义名称（双击/右键重命名）；缺省时按索引显示"片段 N" */
  name?: string
}

/** 记录（pattern）文档 */
export interface PatternRecord {
  _id: string
  _rev?: string
  /** 标题 */
  title: string
  /** 场景/备注，列表摘要取首行 */
  scenario: string
  /** 多片段，一期至少 1 个 */
  fragments: Fragment[]
  /** 分类唯一归属；null = 未分类 */
  categoryId: string | null
  /** 多标签 */
  tags: string[]
  /** 收藏（库视图"收藏"筛选） */
  favorite: boolean
  /** 软删除（回收站视图；真正删除仅发生在回收站内） */
  deleted: boolean
  createdAt: number
  updatedAt: number
  version: 1
}

/** 分类文档 */
export interface Category {
  _id: string
  _rev?: string
  name: string
  order: number
  /** 默认片段语言（该文件夹视图下新建片段的语言；缺省时继承全局默认） */
  defaultLanguage?: string
  createdAt: number
  updatedAt: number
  version: 1
}

export const PATTERN_PREFIX = 'pattern/'
export const CATEGORY_PREFIX = 'category/'

/** 未分类哨兵（筛选语义，非真实分类 id） */
export const UNCATEGORIZED = '__uncat__'

/** 附件 id 前缀：pattern/<patternId>/img-<ts> */
export const ATTACHMENT_PREFIX = 'pattern/'

/** 附件引用正则：![](att://<id>)（捕获组含 att:// 前缀，由 resolveAttRef 剥离校验） */
export const ATT_REF_RE = /!\[[^\]]*\]\((att:\/\/[^)]+)\)/g

export function isNote(record: PatternRecord): boolean {
  // 类型推断：fragments 全部为 markdown ⇒ 笔记，否则片段
  return (
    record.fragments.length > 0 &&
    record.fragments.every((f) => f.language === 'markdown')
  )
}

export function firstLine(text: string): string {
  const line = text.split('\n')[0] ?? ''
  return line.trim()
}
