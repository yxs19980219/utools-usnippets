# 片段搜索视图：独立快捷命令 + 片段级搜索复制

## Goal

新增一个**独立的 uTools feature（快捷命令入口）**，从启动台输入命令词进入一个轻量"片段搜索视图"：
只展示**代码片段**（排除笔记/markdown），用 uTools 主输入框实时过滤，列表以**片段为粒度**展示
（归属记录标题 + 片段名 + 语言 + 内容预览 + 命中高亮），回车/单击**复制该片段内容**并自动退出 uTools。

用户价值：主界面是"浏览 + 编辑"的重视图；本视图是"快速复制片段"的轻路径——更快、更聚焦，笔记不进本视图。

## Confirmed Facts

- 主界面 `pattern-vault` 用 `utools.setSubInput` 注册搜索（`App.tsx:64`），退出时 `removeSubInput`（`App.tsx:71`）。
- **uTools 子输入框无键盘事件 API**（`utools-api.md:1133` 仅 `onChange` 文本回调）——键盘导航（方向键/回车/Ctrl+C）
  必须在**页面内输入框**实现。搜索视图因此用页面内输入框，**不注册 setSubInput**；主界面维持现状。
- 入口路由在 `App.tsx:60` 的 `onPluginEnter` 按 `action.code` 分发，目前仅 `pattern-vault`。
- `plugin.json` 目前仅一个 feature `pattern-vault`，cmds `["模式库", "Pattern Vault"]`，`development.main = localhost:5175`。
- 片段数据结构：`Fragment { id, language, content, name? }`（`types.ts:6`）；笔记判定 `isNote()` = fragments 全为 markdown（`types.ts:58`）。
- 现有过滤 `filterPatterns` 是**记录级**（标题/场景/标签/正文，`lib/search.ts`）——本视图需要**片段级**过滤（新逻辑）。
- 复制：`lib/clipboard.ts copyText()`（优先 `utools.copyText`）。
- **粘贴到原光标处**：`utools.hideMainWindowPasteText(text)`（`utools-api.md:1672`，隐藏窗口并模拟输入到打开 uTools 前所在应用的光标处）。
- 退出 API：`utools.outPlugin()`（`utools-api.md:1241`）。

## Requirements

### R1 独立入口（feature + 路由）
- `plugin.json` 新增 feature：`code: "pattern-vault-search"`，`cmds: ["片段搜索", "复制片段"]`，
  `explain` 描述为"快速复制代码片段"。
- `App.tsx` `onPluginEnter` 按 `action.code` 分发：`pattern-vault-search` → 渲染搜索视图；
  `pattern-vault` → 现有三栏主界面（不变）。

### R2 搜索视图（轻量，无侧栏/列表/编辑三栏）
- 独立组件（如 `SearchView`），全窗口纵向布局：顶部为**页面内输入框**（进入即 autofocus），
  下方为可滚动列表；不渲染 Sidebar/ListPane/EditorPane。
- **用页面内输入框而非 uTools 子输入框**：后者无键盘事件 API，无法支持方向键/回车/Ctrl+C
  （见 Confirmed Facts）。搜索视图**不注册 setSubInput**；主界面 `pattern-vault` 的 setSubInput 维持现状。
- 输入实时更新 query 过滤；placeholder 如"搜索片段：内容 / 标题…"。退出（`onPluginOut`）无需清理子输入框。

### R3 片段级搜索（排除笔记）
- 遍历所有**非回收站**记录的**非 markdown 片段**，生成片段条目；笔记（`isNote`）整条排除。
- query 匹配：片段 `content`（includes，小写）或 所属记录 `title` / `scenario` / `tags`（includes）。
- 进入时**默认显示全部片段**（可滚动浏览），输入即实时过滤。

### R4 列表项展示
- 每个列表项 = 一个片段：
  - 第一行：所属记录标题（组首显示）+ 片段名（`Fragment.name` 或"片段 N"）+ 语言徽标（右侧）
  - 第二行：内容预览（前 1~3 行，超长截断），命中关键词高亮
- 同记录多片段**相邻归组**：组首项显示完整标题，后续项缩进 + 浅色副标题，避免重复刷标题。

### R5 交互（页面内输入框捕获键盘）
- **方向键 ↑↓**：移动选中项（`activeIndex`，与 hover 高亮同步，自动滚动可见）。
- **Enter**：`utools.hideMainWindowPasteText(content)` —— 隐藏窗口并把片段内容**输入到打开 uTools 前所在应用的光标处**（"enter 直接在当前光标后输入"）。
- **Ctrl+C**：`copyText(content)` 复制到剪贴板，留在视图，可继续复制其他片段。
- **单击**：`copyText(content)` 复制到剪贴板，留在视图（可连续复制）。
- 不做 toast。视图纯复制定位：不进入编辑区、不提供收藏/删除等管理操作。
- 技术依据：uTools 子输入框无键盘事件 API（`utools-api.md:1133`），键盘导航必须用页面内输入框。

## Acceptance Criteria

- [ ] uTools 启动台输入"片段搜索"或"复制片段"进入独立搜索视图，主界面入口"模式库"行为不变
- [ ] 视图内无侧栏/列表/编辑三栏，只有主输入框 + 片段列表
- [ ] 笔记（全部 markdown 的片段）不出现在列表中；仅代码片段
- [ ] 进入即显示全部片段；输入关键词后实时过滤（匹配内容/标题/场景/标签，大小写不敏感）
- [ ] 列表项含记录标题 + 片段名 + 语言徽标 + 内容预览；命中词高亮
- [ ] 同记录多片段相邻归组，标题只在组首显示一次
- [ ] 方向键 ↑↓ 移动选中；Enter 粘贴到原窗口光标处并隐藏；Ctrl+C 与单击复制并留在视图
- [ ] `npm run build` 通过（含 tsc）
- [ ] 开发模式（dev）下两个入口均可触发

## Out of Scope

- 搜索视图内的编辑 / 收藏 / 删除等管理操作
- 笔记在搜索视图中的任何展示
- 搜索历史 / 记忆 / 拼音匹配（uTools 主输入框自身提供部分能力，不做自定义增强）
- 修改主界面现有行为

## Open Questions

- 无阻塞问题。快捷命令词与初始显示全部片段等已在 Requirements 中给定，待用户批准。

## Notes

- 复杂任务：需 `design.md` + `implement.md` 后再 `task.py start`。
