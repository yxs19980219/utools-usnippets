# Design —— 中栏置顶功能 + 主界面搜索框不显示修复

## A. 置顶功能

### 数据模型

```ts
// src/types.ts PatternRecord 新增
pinnedAt?: number | null   // 置顶时间戳（ms）；null/undefined = 未置顶
```

- 兼容：`load` 归一化（`r.pinnedAt = r.pinnedAt ?? null`），与 favorite/deleted 处理一致
- 持久化：随 record 文档落 utools.db（savePattern 全量写）——置顶/取消置顶走
  `enqueue(() => savePattern(record))` 立即落库（与 toggleFavorite 一致，不强依赖防抖）

### Store

```ts
// src/stores/records.ts
togglePin: (id: string) => void
// 置顶：pinnedAt = Date.now()（后置顶天然时间更晚）
// 取消置顶：pinnedAt = null
// 复用 toggleFavorite 模式：立即 enqueue savePattern
```

### 排序（核心：后置顶优先）

`src/lib/search.ts` 的 `sortByRecent`（ListPane 用）改为双组：

```ts
function sortByRecent(records: PatternRecord[]) {
  const pinned = records.filter((r) => r.pinnedAt).sort((a, b) => (b.pinnedAt! - a.pinnedAt!))
  const rest = records.filter((r) => !r.pinnedAt).sort(按 updatedAt desc 现状)
  return [...pinned, ...rest]
}
```

- `records` store 的 load 排序（b.updatedAt - a.updatedAt）**保持现状**：中栏列表经
  `byView` + `sortByRecent` 二次排序，搜索视图用 records 原序——置顶策略只作用于
  中栏 ListPane（用户需求范围内）；搜索视图竞价级排序不在本次 scope（prd 验收已注明）
- 组内排序均为稳定倒序，不会因置顶时间相同而乱序（Date.now() 同毫秒边界可接受）

### 列表 UI

- `ListPane.tsx` ContextMenu 非回收站分支新增项（收藏项下方）：
  `<PinIcon /> {record.pinnedAt ? '取消置顶' : '置顶'}`（lucide PinIcon）
- 列表项视觉：`pinnedAt` 存在时标题行显示小 PinIcon（仿 FileTextIcon 的位置，置顶时
  用主题色强调）——**注意中栏宽度 160px，图标要 `size-3 shrink-0` 不挤标题**

### 边界

- 回收站（inTrash）分支不加置顶项：回收站内记录不参与置顶语义（移出回收站恢复原置顶态合理）
- 删除记录：pinnedAt 随文档删除，无残留
- 导入/导出 JSON：pinnedAt 为可选字段，导出的 `PatternRecord` 结构含它（import-export 按
  记录文档白名单字段处理——若为严格白名单需同步加字段；实现时检查 import-export 的字段列表）

## B. 搜索框竞态修复

### 现状（问题代码）

```tsx
// App.tsx
ut?.onPluginEnter?.((action) => {
  setEnterCode(action.code)
  if (action.code === 'pattern-vault-search') { ut.removeSubInput?.(); return }
  ut.setSubInput?.(({ text }) => useUi.getState().setSearchQuery(text), '搜索模式库…', true)
})
// SearchView.tsx
useEffect(() => {
  window.utools?.setSubInput?.(..., true)
  return () => { window.utools?.removeSubInput?.() }
}, [])
```

竞态：onPluginEnter 回调（同步）先 setSubInput(主) → React 渲染 → SearchView unmount
cleanup removeSubInput() → 主界面输入框被清掉。

### 修复：渲染层统一收口

- `App.tsx`：onPluginEnter 回调**只保留 setEnterCode**；子输入框注册改为渲染层 effect，
  依赖 `enterCode`——React 保证卸载组件 cleanup 先于保活/新组件的 effect 执行，
  从而 SearchView 的 removeSubInput 永远先于主界面的 setSubInput：

```tsx
// App.tsx —— 两个视图输入框的注册/移除统一定义
useEffect(() => {
  const ut = window.utools
  if (!ut?.setSubInput) return
  if (enterCode === 'pattern-vault-search') return   // 搜索视图自管
  ut.setSubInput?.(
    ({ text }) => useUi.getState().setSearchQuery(text),
    '搜索模式库：标题、备注、标签、正文',
    true,
  )
  return () => { ut.removeSubInput?.() }
}, [enterCode])
```

- `SearchView.tsx`：**保持自身 mount effect 不变**（其 cleanup 仍是"进入主界面时移除
  搜索视图输入框"的执行者）——只有 App 侧从"回调时刻"改为"渲染 effect 时刻"
- `onPluginOut` 的 removeSubInput 保留（双保险，重复调用无副作用）

### 预期行为矩阵（验证用）

| 转移 | 顺序（React 保证） | 结果 |
|------|-------------------|------|
| 搜索→主界面 | SearchView cleanup(rem) → App effect set | 主界面框 ✓ |
| 主界面→搜索 | App effect cleanup(rem) → SearchView mount set | 搜索框 ✓ |
| 插件退出 | App effect cleanup(rem) + onPluginOut(rem) | 干净 ✓ |
