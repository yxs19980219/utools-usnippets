import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { ListPane } from '@/components/ListPane'
import { EditorPane } from '@/components/EditorPane'
import { SearchView } from '@/components/SearchView'
import { SettingsDialog } from '@/components/SettingsDialog'
import { ToastContainer } from '@/components/ToastContainer'
import { useRecords } from '@/stores/records'
import { useCategories } from '@/stores/categories'
import { useSettings } from '@/stores/settings'
import { useUi } from '@/stores/ui'

export default function App() {
  const darkMode = useSettings((s) => s.darkMode)
  // 入口 feature code：pattern-vault-search → 独立搜索视图；其余 → 三栏主界面
  const [enterCode, setEnterCode] = useState<string | null>(null)

  // 启动加载：设置 → 记录 → 分类
  useEffect(() => {
    useSettings.getState().load()
    void useRecords.getState().load()
    void useCategories.getState().load()
  }, [])

  // 深色模式跟随（design.md §5.6：.dark 类 + prefers-color-scheme + isDarkColors）
  useEffect(() => {
    const apply = () => {
      const dark =
        darkMode === 'dark' ||
        (darkMode === 'system' &&
          (window.utools?.isDarkColors?.() ??
            window.matchMedia('(prefers-color-scheme: dark)').matches))
      document.documentElement.classList.toggle('dark', dark)
      useUi.getState().setDark(dark)
    }
    apply()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    document.addEventListener('visibilitychange', apply)
    return () => {
      mq.removeEventListener('change', apply)
      document.removeEventListener('visibilitychange', apply)
    }
  }, [darkMode])

  // 退出前 flush 挂起的自动保存
  useEffect(() => {
    const flush = () => {
      void useRecords.getState().flushSave()
    }
    window.addEventListener('beforeunload', flush)
    window.addEventListener('pagehide', flush)
    window.utools?.onPluginOut?.(flush)
    return () => {
      window.removeEventListener('beforeunload', flush)
      window.removeEventListener('pagehide', flush)
    }
  }, [])

  // 入口路由 + uTools 子输入框搜索（design：搜索用 uTools 搜索接口，非插件内搜索）
  useEffect(() => {
    const ut = window.utools
    ut?.onPluginEnter?.((action) => {
      setEnterCode(action.code)
      console.log('[pattern-vault] enter', action.code)
      if (action.code === 'pattern-vault-search') {
        // 搜索视图用页面内输入框（uTools 子输入框无键盘事件 API），不注册子输入框；
        // 若此前在主界面注册过，先移除避免残留
        ut.removeSubInput?.()
        return
      }
      // 窗口高度不干预：默认 800×600（plugin.json），用户手动拉伸后由 uTools 记忆
      ut.setSubInput?.(
        ({ text }) => useUi.getState().setSearchQuery(text),
        '搜索模式库：标题 / 场景 / 标签 / 正文…',
        true,
      )
    })
    ut?.onPluginOut?.(() => {
      ut.removeSubInput?.()
    })
  }, [])

  const collapsed = useUi((s) => s.sidebarCollapsed)

  // 片段搜索视图：全窗口单视图，无侧栏/列表/编辑三栏
  if (enterCode === 'pattern-vault-search') {
    return <SearchView />
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 flex-1">
        {!collapsed && <Sidebar />}
        <ListPane />
        <EditorPane />
      </div>
      <ToastContainer />
      <SettingsDialog />
    </div>
  )
}
