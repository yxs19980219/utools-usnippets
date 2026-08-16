# 片段搜索视图 —— 执行计划

## 实施清单（按序）

1. **`public/plugin.json`**：新增 feature
   ```json
   {
     "code": "pattern-vault-search",
     "explain": "快速复制代码片段（片段级搜索，不含笔记）",
     "cmds": ["片段搜索", "复制片段"]
   }
   ```

2. **`src/lib/search.ts`**：新增片段级逻辑
   - `SnippetEntry` 接口
   - `buildSnippetEntries(records): SnippetEntry[]`（排除 deleted/isNote、过滤 markdown 片段、`groupStart` 标记）
   - `filterSnippets(entries, query): SnippetEntry[]`（content/title/scenario/tags 小写 includes）

3. **`src/components/SearchView.tsx`**（新建）
   - 顶部页面内 `Input`（autofocus，`onChange` → `setQuery`）+ 可滚动列表
   - `useRecords` → `useMemo` 构建 entries + filtered + `activeIndex`
   - 列表项两行布局 + 命中高亮（`<mark>`）+ 选中态（`bg-accent`）+ hover
   - 键盘（Input `onKeyDown`）：↑↓ 移动选中；Enter → `window.utools?.hideMainWindowPasteText?.(content)`；
     Ctrl/Cmd+C → `copyText(content)`
   - 单击 → `copyText(content)`（留视图）
   - **不注册 setSubInput**

4. **`src/types/utools.d.ts`**：补充 `hideMainWindowPasteText` 类型声明
   - 现状仅声明 `hideMainWindow`（`utools.d.ts:72`），Enter 粘贴用 `hideMainWindowPasteText(text): boolean`
   - 在 `hideMainWindow` 旁新增声明，签名对照 `utools-api.md:1679`

5. **`src/App.tsx`**：入口路由
   - `useState<ViewMode>` 或在 effect 内记录 `action.code`（如 `enterCode`）
   - `action.code === 'pattern-vault-search'` → 渲染 `<SearchView />`；否则现状三栏
   - **搜索视图分支不调用 `setSubInput`**；主界面分支维持现有 `setSubInput`/`removeSubInput`

6. **构建验证**：`npm run build`（含 tsc）通过

## 验证命令

- `npm run build`（tsc + vite）
- 开发手测（uTools 开发者工具加载 `public/` + `npm run dev`）：
  1. 输入"模式库" → 三栏主界面正常，子输入框过滤正常
  2. 输入"片段搜索" → 独立视图：无三栏、页面内输入框聚焦、显示全部片段（无笔记）
  3. 输入过滤词 → 实时过滤 + 命中高亮
  4. ↑↓ 移动选中；Ctrl+C / 单击复制到剪贴板且留在视图；Enter 隐藏窗口并把内容输入到原应用光标处

## 风险文件 / 回滚点

- `public/plugin.json`：新增段可整体删除
- `src/App.tsx`：路由分支是加法，回滚删分支即可
- `src/components/SearchView.tsx`：新文件，删除即回滚
- `src/lib/search.ts`：新增函数，不修改现有 `filterPatterns`

## start 前检查

- [ ] prd.md / design.md / implement.md 均已落盘
- [ ] 用户已批准最终规划总结
