# Pattern Vault 二期 — 技术设计

## 0. 前置（调研产物）

- 调研报告：`.trellis/tasks/08-15-pattern-vault-phase2/research/`（6 份：overview、atomic 扩展、图片接入、math/KaTeX、备选矩阵、集成与兼容）。
- 结论速览：atomic 底层组合（`createEditorView` 级）✅ 支持自定义扩展；图片需仿写 imageBlocks 加 resolver；mathPlugin 可与 atomic 共存；增量 ~160KB gzip；Chromium 91-102 兼容。

## 1. 架构与边界

```
src/components/editor/
├── CodeBlock.tsx        ← 一期保持：非 markdown 语言（js/sql/...）
└── MarkdownEditor.tsx   ← 二期新增：markdown 语言 → atomic 组合
      ├── atomicEditor(底层组合)     [@atomic-editor/editor]
      ├── math 扩展                  [codemirror-live-markdown mathPlugin/blockMathField]
      ├── imageBlocks 仿写(resolver) [src/lib/attachment.ts]
      └── 快捷键 keymap
```

- `CodeBlock` 对外接口（value/onChange/language/onPasteImage/dark）保持不变，`EditorPane` 按 `language === 'markdown'` 路由到 `MarkdownEditor`，其余不变。
- 数据层、stores、preload 零改动。

## 2. MarkdownEditor 实现要点

### 2.1 atomic 底层组合（研究 q1）
- 用 `@atomic-editor/editor` 导出的扩展组（inlinePreview/tables/imageBlocks 仿写版/atomicMarkdownSyntax/atomicEditorTheme）+ 自建 `EditorView`（React wrapper 无法注入图片 resolver，故用底层）。
- `extensions` 一次性挂载（mount 时捕获），后续语言/主题变更走 compartment。
- 记录切换：以 `documentId` 语义重建/更新 view（替代一期 value-sync），光标/undo 状态按记录隔离。

### 2.2 图片（研究 q2）
- 仿写官方 `imageBlocks()`：在官方实现（~230 行）上加 `resolveImage(src): string | null` 参数：
  - `att://pattern/<id>/img-<ts>` → `imageToBlobUrl(id)`（一期 lib/attachment.ts 已预留）异步预取到 Map → widget 显示。
  - 非 att:// 的 URL 直通。
- 粘贴图片：复用一期拦截逻辑（CodeBlock 的 paste handler 模式），先附件后正文。

### 2.3 公式（研究 q3）
- 按需 import：`import { mathPlugin, blockMathField } from 'codemirror-live-markdown'`（锁 `0.5.1-alpha.1`）。
- KaTeX：显式安装 `katex@0.18.x`，math 模块通过 `window.katex` 访问 → 在 preload 或入口显式 `window.katex = require('katex')` 注入（渲染进程 bundle 引入亦可，但 live-md 走全局，需确认接入方式，以研究 q3 结论为准）。
- 行内 `$...$` 与块级 ```math 均启用；错误时回退显示源码（KaTeX throwOnError:false）。

### 2.4 快捷键
- 仅 markdown 编辑器：Mod-B/Mod-I、Mod-K、Mod-1..6、Mod-Shift-C 等（CM6 keymap + 或 live-md 提供）。
- 不影响 CodeBlock 默认 keymap。

## 3. 笔记/片段区分

### 3.1 新建二选一
- `ListPane` 头部 `＋` 改为 Popover 菜单：`[FileCode 片段]` / `[BookOpen 笔记]`。
- 片段 = 一期 createRecord（默认 js 片段）；笔记 = 单 markdown 片段（`fragments: [{language: 'markdown', content: ''}]`）。
- records store 加 `createNote()`（复用 createRecord 参数化）。

### 3.2 图标区分
- `lib/icons.ts` listMeta 恢复 isNote → BookOpenIcon / FileCode2Icon，`ListItem` 行首显示（一期曾移除，二期加回）。

## 4. 兼容与体积

- vite `build.target: 'chrome88'` 显式设置（研究 q6）。
- atomic CSS color-mix：Lightning CSS 已降级（一期配置）；如产物仍有裸 color-mix（无 var 可静态求值），加 @supports fallback 或接受视觉降级（研究 q6 给出 5 处清单）。
- KaTeX 字体资源：本地打包（发布版禁止外部网络资源），走 assets。
- bundle 预期：一期 340KB gzip → 二期 ~500KB gzip。

## 5. 回归保障

- 非 markdown 语言（js/sql/...）编辑器路径与一期完全相同（CodeBlock 不动）。
- 自动保存（onChange 防抖）、图片粘贴落库、搜索/视图/回收站/收藏、导入导出——store 与数据层零改动，天然回归。
- 构建门禁：`npm run build`（tsc + vite）通过。

## 6. 风险与兜底

| 风险 | 兜底 |
|---|---|
| live-md alpha 兼容 | 锁版本；实现已分析共存；不兼容 → 仿写（StateField+WidgetType+KaTeX，~100 行） |
| atomic 上游 PR #7（裸 URL） | 跟踪；影响图片时转自定义图片 widget |
| color-mix 降级 | 静态求值 + @supports fallback；最坏视觉降级 |
| 混排实测失败 | 最小 mock（公式+表格+图片）先行验证，再全量集成 |
