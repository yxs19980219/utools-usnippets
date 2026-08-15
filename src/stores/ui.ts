/**
 * stores/ui.ts —— 界面状态（选中/折叠/视图/搜索）
 *
 * - view：左栏导航（库：所有/收藏/回收站；文件夹：分类；标签），中栏列表按它过滤
 * - searchQuery（顶栏 uTools 子输入框）= 全局搜索，非空时进入搜索态：
 *   全库匹配（排除回收站），忽略 view，左栏失效；清空时恢复进入搜索前的选中
 */

import { create } from 'zustand'

/** 左栏导航视图 */
export type ViewType = 'all' | 'favorites' | 'trash' | 'category' | 'tag'

export interface ViewState {
  type: ViewType
  /** category 视图：分类 id（null = 未分类）；tag 视图：标签名 */
  id?: string | null
}

interface UiState {
  /** 当前选中的记录 id */
  selectedId: string | null
  /** 左栏是否折叠 */
  sidebarCollapsed: boolean
  /** 当前导航视图 */
  view: ViewState
  /** 全局搜索词（顶栏 uTools 子输入框），非空 = 搜索态 */
  searchQuery: string
  /** 进入搜索态时的选中快照（清空搜索后恢复） */
  searchSnapshot: { selectedId: string | null } | null
  /** 设置面板开关 */
  settingsOpen: boolean
  /** 当前激活的片段 tab id */
  activeFragmentId: string | null
  /** 当前深色状态（App 应用后同步，供编辑器等组件订阅） */
  dark: boolean

  setSelected: (id: string | null) => void
  toggleSidebar: () => void
  setView: (view: ViewState) => void
  setSearchQuery: (q: string) => void
  setSettingsOpen: (open: boolean) => void
  setActiveFragment: (id: string | null) => void
  setDark: (dark: boolean) => void
}

const COLLAPSE_KEY = 'pattern-vault.ui.sidebarCollapsed'

function readCollapsed(): boolean {
  try {
    return window.utools?.dbStorage?.getItem(COLLAPSE_KEY) === true
  } catch {
    return false
  }
}

export const useUi = create<UiState>((set) => ({
  selectedId: null,
  sidebarCollapsed: readCollapsed(),
  view: { type: 'all' },
  searchQuery: '',
  searchSnapshot: null,
  settingsOpen: false,
  activeFragmentId: null,
  dark: false,

  setSelected: (id) => set({ selectedId: id }),
  toggleSidebar: () =>
    set((s) => {
      const next = !s.sidebarCollapsed
      try {
        window.utools?.dbStorage?.setItem(COLLAPSE_KEY, next)
      } catch {
        // ignore
      }
      return { sidebarCollapsed: next }
    }),
  setView: (view) => set({ view }),
  setSearchQuery: (q) =>
    set((s) => {
      if (q === s.searchQuery) return {}
      const entering = q !== '' && s.searchQuery === ''
      const leaving = q === '' && s.searchQuery !== ''
      if (entering) {
        // 进入搜索态：快照当前选中并清空选中（展示全库结果列表），退出时恢复
        return {
          searchQuery: q,
          searchSnapshot: { selectedId: s.selectedId },
          selectedId: null,
        }
      }
      if (leaving) {
        const snap = s.searchSnapshot
        return {
          searchQuery: '',
          searchSnapshot: null,
          selectedId: snap?.selectedId ?? s.selectedId,
        }
      }
      return { searchQuery: q }
    }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setActiveFragment: (id) => set({ activeFragmentId: id }),
  setDark: (dark) => set({ dark }),
}))
