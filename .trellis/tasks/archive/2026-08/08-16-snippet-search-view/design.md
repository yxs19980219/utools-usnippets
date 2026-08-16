# 片段搜索视图 —— 技术设计

## 1. 架构与边界

```
plugin.json feature "pattern-vault-search" (cmds 片段搜索/复制片段)
        │ onPluginEnter action.code
        ▼
App.tsx 路由分发 ── code === 'pattern-vault-search' ──► <SearchView />
        │
        └── code === 'pattern-vault'（现状）──► Sidebar + ListPane + EditorPane
```

- `SearchView` 全窗口单视图（无三栏），顶部 uTools 子输入框 + 下方列表。
- 复用现有数据层：`useRecords`（`stores/records`，启动已 `load()`）；不新增 store。
- 复用 `copyText`（`lib/clipboard.ts`）与既有 UI token / `cn` / Badge。

## 2. 数据流与片段条目模型

```
records (store) ──flatten──► SnippetEntry[] ──query──► filtered ──render──► 列表
```

**flatten（片段条目化，useMemo，依赖 records）**：
- 排除 `record.deleted` 与 `isNote(record)`（全 markdown）的记录
- 对记录内 `language !== 'markdown'` 的每个片段生成：
  ```ts
  interface SnippetEntry {
    recordId: string
    recordTitle: string
    recordScenario: string
    recordTags: string[]
    fragmentId: string
    fragmentIndex: number        // 片片段序（组内排序）
    name: string                 // Fragment.name ?? `片段 ${index+1}`
    language: string
    content: string
    groupStart: boolean          // 该片段是否是其记录的组首
  }
  ```
- 数组按"记录序 → 片片段序"展平，天然满足同记录相邻归组；`groupStart` 标记组首。

**query 过滤（useMemo，依赖 entries + query）**：
- `query` 小写化；条目命中条件：`content` / `recordTitle` / `recordScenario` / `recordTags` 任一 `includes`。
- query 为空 → 全量显示（进入即浏览全部）。

## 3. 列表渲染、高亮与键盘导航

- 顶部**页面内输入框**（`Input`，autofocus）驱动 `query`。
- 列表项两行：
  - 第一行：`recordTitle`（仅 `groupStart` 显示，其余缩进）+ `name` + 语言徽标（右侧，复用 Badge）
  - 第二行：内容预览（取前 3 行拼接，超长 `truncate`/`line-clamp`），命中词高亮
- **命中高亮**：按小写不敏感把 `content` 拆分为 segments，命中段包 `<mark>`（Chrome 88 原生支持，默认黄底；如需主题色用 `bg-accent` 的 `<span>`）。仅高亮 `content` 内的命中（标题/场景不单独高亮，保持简单）。
- 滚动：`overflow-y-auto`；**选中态** `activeIndex` 高亮（`bg-accent text-accent-foreground`，与主界面一致），
  hover 弱高亮；输入框 `onKeyDown` 处理 ↑↓/Enter/Ctrl+C（见 §4）。

## 4. uTools 集成与输入方案

- **输入 = 页面内输入框**（autofocus），**不使用 uTools 子输入框**：
  `setSubInput` 仅提供文本 `onChange`，无键盘事件 API（`utools-api.md:1133`），无法捕获方向键/回车/Ctrl+C。
  `SearchView` 内用 `Input` 组件 + `onKeyDown` 实现键盘导航。
- **键盘导航**（Input `onKeyDown`）：
  - `ArrowUp/ArrowDown` → `activeIndex` 增减（clamp + 滚动到可见）
  - `Enter` → `window.utools?.hideMainWindowPasteText?.(content)`（隐藏窗口 + 输入到打开 uTools 前所在应用光标处）
  - `Ctrl/Cmd+C` → `copyText(content)`（留在视图）
- **单击**：`copyText(content)`（留在视图）。
- **退出**：Enter 走 `hideMainWindowPasteText`（自带隐藏）；Ctrl+C/单击不退出；不依赖 `onPluginOut` 清理子输入框（未注册）。
- 深色模式：复用 `useSettings.darkMode` 的 `.dark` 切换（全局已处理，SearchView 直接用 token 即可）。

## 5. 兼容性与 trade-off

- **Chrome 88**：不用 color-mix/oklch 新语法；高亮用 `<mark>` 或固定 rgba。
- **页面内输入框 vs uTools 子输入框**：页面内输入框支持键盘导航（方向键/回车/Ctrl+C），但视觉是自绘输入框
  （与 uTools 原生输入框风格略有差异）；主界面 `pattern-vault` 仍用 uTools 子输入框（现状不变），两视图输入风格可接受地共存。
- **Enter 语义**：`hideMainWindowPasteText` 把内容"输入"到用户原光标处（非剪贴板复制），符合"enter 直接在当前光标后输入"。
- **不侵入主界面**：路由按 `action.code` 分支，`pattern-vault` 行为零改动。

## 6. 风险与回滚

- 风险低：新增组件 + 分支路由，不触碰主界面/数据写入。`plugin.json` 新增 feature 不破坏现有入口。
- 回滚：删除 feature 段 + 路由分支即可。
