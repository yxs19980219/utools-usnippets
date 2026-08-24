/**
 * stores/categories.ts —— 分类管理
 * 删除分类 → 其下记录移入回收站（可恢复，不物理删除）
 */
import { create } from 'zustand'
import type { Category } from '../types'
import { CATEGORY_PREFIX } from '../types'
import { uuid } from '../lib/uuid'
import {
  deleteCategory,
  loadCategories,
  saveCategory,
} from '../lib/db'
import { useRecords } from './records'

interface CategoriesState {
  categories: Category[]
  loaded: boolean
  load: () => Promise<void>
  create: (name: string) => Promise<Category | null>
  rename: (id: string, name: string) => Promise<boolean>
  setDefaultLanguage: (id: string, language: string) => Promise<boolean>
  remove: (id: string) => Promise<void>
  /** 置顶/取消置顶 toggle（立即落库，后置顶优先级更高） */
  togglePin: (id: string) => Promise<boolean>
}

export const useCategories = create<CategoriesState>((set, get) => ({
  categories: [],
  loaded: false,

  load: async () => {
    const categories = await loadCategories()
    // 归一化：旧数据可能缺少 pinnedAt 字段
    for (const c of categories) {
      if (c.pinnedAt === undefined) c.pinnedAt = null
    }
    categories.sort((a, b) => a.order - b.order)
    set({ categories, loaded: true })
  },

  create: async (name) => {
    const now = Date.now()
    const category: Category = {
      _id: `${CATEGORY_PREFIX}${uuid()}`,
      name: name.trim(),
      order: get().categories.length,
      createdAt: now,
      updatedAt: now,
      version: 1,
    }
    const ok = await saveCategory(category)
    if (!ok) return null
    set({ categories: [...get().categories, category] })
    return category
  },

  rename: async (id, name) => {
    const cat = get().categories.find((c) => c._id === id)
    if (!cat) return false
    cat.name = name.trim()
    cat.updatedAt = Date.now()
    const ok = await saveCategory(cat)
    if (!ok) return false
    set({ categories: [...get().categories] })
    return true
  },

  setDefaultLanguage: async (id, language) => {
    const cat = get().categories.find((c) => c._id === id)
    if (!cat) return false
    cat.defaultLanguage = language || undefined
    cat.updatedAt = Date.now()
    const ok = await saveCategory(cat)
    if (!ok) return false
    set({ categories: [...get().categories] })
    return true
  },

  remove: async (id) => {
    // 先将其下记录移入回收站（分类归属清空，恢复后落入收件箱），再删分类
    await useRecords.getState().moveCategoryToTrash(id)
    const ok = await deleteCategory(id)
    if (!ok) return
    set({ categories: get().categories.filter((c) => c._id !== id) })
  },

  togglePin: async (id) => {
    const cat = get().categories.find((c) => c._id === id)
    if (!cat) return false
    cat.pinnedAt = cat.pinnedAt ? null : Date.now()
    cat.updatedAt = Date.now()
    const ok = await saveCategory(cat)
    if (!ok) return false
    set({ categories: [...get().categories] })
    return true
  },
}))
