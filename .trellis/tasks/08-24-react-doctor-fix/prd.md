# react-doctor 诊断修复：errors + 低风险类

## Goal

修复 react-doctor v0.9.12 全量扫描（schema v3、scope=full）发现的 4 个 error 与低风险 warning（清理类 + 算法性能类），不改变应用行为与视觉，不触达 a11y/组件结构/按需加载类诊断。

## Requirements

背景：Pattern Vault（uTools 代码片段插件，React 19 + Vite + TS + CodeMirror + zustand）。初始扫描结果：4 error / 42 warning / 21 文件。本次范围：

- **Error（4）**：`no-ref-current-in-render` ×4
  - src/components/editor/CodeBlock.tsx:141-142
  - src/components/editor/MarkdownEditor.tsx:139-140
- **清理类（8 处，7 项诊断 + button.tsx 的 only-export-components 一并评估）**
  - `deslop/unused-dependency`：package.json `@lezer/lr`
  - `deslop/unused-file` ×2：src/components/ui/badge.tsx、src/components/ui/textarea.tsx
  - `deslop/unused-export` ×3：src/lib/db.ts:182 `servicesReady`、src/lib/search.ts:75 `previewSnippet`、src/types.ts:61 `ATTACHMENT_PREFIX`
  - `react-doctor/only-export-components` ×2：badge.tsx（文件删除自然消解）、button.tsx:54
- **算法性能类（12）**：
  - `react-doctor/async-await-in-loop` ×6：src/lib/import-export.ts:67,175,184,189、src/stores/records.ts:161,204
  - `react-doctor/js-combine-iterations` ×2：src/lib/db.ts:23,60
  - `react-doctor/js-index-maps` ×1：src/stores/records.ts:159
  - `react-doctor/js-set-map-lookups` ×2：src/components/editor/TagEditor.tsx:43、src/lib/export-images.ts:40
  - `react-doctor/no-create-object-url-without-revoke` ×1：src/lib/attachment.ts:36
  - `react-doctor/no-effect-chain` ×1：src/components/SearchView.tsx:322
- **同源修复**：`react-doctor/rerender-lazy-ref-init` ×2（CodeBlock.tsx:138-139，与 no-ref-current-in-render 同文件同模式）

## Out of Scope

- 可访问性类（click-events-have-key-events ×3、no-static-element-interactions ×4、control-has-associated-label ×2、no-placeholder-only-field ×2）
- 结构类：no-giant-component（Sidebar 300+ 行拆分）
- prefer-dynamic-import ×8（CodeMirror 按需加载，需单独设计评估）
- react-doctor 规则配置/抑制（不通过禁用规则达到清报告目的）

## Acceptance Criteria

- [ ] `tsc -b`（项目 build 的 type-check 阶段）通过，`npm run build` 成功
- [ ] react-doctor 全量重扫（同版本 0.9.12、scope=full）：错误数 0
- [ ] 重扫后本任务清单的 warning 全部消失：unused-dependency、unused-file、unused-export、only-export-components、async-await-in-loop、js-combine-iterations、js-index-maps、js-set-map-lookups、no-create-object-url-without-revoke、no-effect-chain、rerender-lazy-ref-init
- [ ] 重扫未引入新诊断（与基线逐条比对）
- [ ] 应用行为/视觉无变化（编辑器初始化、语言切换、图片附件、搜索、导入导出流程不受影响）

## Notes

- 删除文件/导出/依赖前必须 grep 确认无其他引用（unused-file/unused-export 以"无模块引用"为前提，需二次确认）
- 所有诊断条目以 .trellis/tasks/08-24-react-doctor-fix 下扫描基线（Temp 目录 initial.json，已包含完整 id）为准
