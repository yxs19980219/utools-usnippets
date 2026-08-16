# UI 细节修复：右键菜单图标/危险色悬停、笔记语言固定、编辑器选中可见

## Goal

修复 4 处 UI 细节问题，全部为既有渲染缺陷或产品决策固化：

1. 右键菜单"移动分类"的图标（FolderInputIcon）比同菜单其他图标大
2. 右键菜单 danger 项（移入回收站 / 彻底删除）hover 时纯红底 + 红字，文字不可读
3. 笔记语言应固定为 markdown，不可通过状态栏语言选择器更改
4. 编辑器（片段 CodeBlock / 笔记 MarkdownEditor）：去掉光标行灰底；选中文本背景在深色/浅色下清晰可见

## Requirements

### R1 菜单图标尺寸统一
- `ContextMenuSubTrigger`（context-menu.tsx）与 `DropdownMenuSubTrigger`（dropdown-menu.tsx）
  补充 `[&_svg:not([class*='size-'])]:size-4`，使"移动分类"图标与其他菜单项同为 16px。

### R2 danger 菜单项 hover 可读
- 根因：`focus:bg-destructive/10` 编译为 `color-mix(in oklab, var(--destructive) 10%, transparent)`，
  Lightning CSS 无法静态降级（变量未知），输出 fallback `background-color: var(--destructive)`（全量红）
  置于 @supports 之外；Chrome 88 不支持 color-mix → 生效的是全量红底 + 红字。
- 修复：danger 项 focus/hover 改为 `bg-destructive` + `text-destructive-foreground`（红底白字，全量 var 色，
  Chrome 88 安全）。同时作用于 `ContextMenuItem` 与 `DropdownMenuItem` 的 destructive variant。

### R3 笔记语言固定 markdown
- StatusBar 中 `language === 'markdown'` 时不渲染语言 Select，改为静态文本 "Markdown"。
- 语言选择列表移除 markdown 选项（防止普通片段被改成 markdown 而静默获得"笔记"身份；
  笔记身份仅由新建笔记路径产生：records.ts `createRecord('note')`）。
- 兼容性：既有已存为 markdown 语言的历史片段不受影响（仍按 markdown 渲染，只是不可再改语言）。

### R4 编辑器灰底与选中可见
- 光标行灰底：`.cm-editor .cm-activeLine` / `.cm-activeLineGutter` 由 `var(--accent)` 改为 `transparent`
  （globals.css 全局 + CodeBlock.tsx theme 内同步），与 markdown 编辑器一致。
- 选中背景：
  - CodeBlock 深色模式：当前被 oneDark `#3E4451`（与 #282c34 背景几乎同色）压掉自身 rgba；
    将 CodeBlock theme 的 selection 规则提升为与 CM base theme 同深度的
    `&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground`（5 类，后注入胜）。
  - MarkdownEditor（atomic）：选中色走 `--atomic-editor-selection-bg`；深色默认回退已降级为 #382658（可见性差），
    浅色 data-theme="light" 定义为 18% 透明紫（几乎不可见）。globals.css 中直接覆盖该变量：
    `.atomic-cm-editor.cm-editor` 深色 → 明显紫；`[data-theme="light"] .atomic-cm-editor.cm-editor` 浅色 → 明显紫。

## Constraints

- uTools 3 内核 = Chrome 88：不使用 color-mix / oklch 等 CSS 能力，一律用固定 rgba/var 全量色。
- 不引入新依赖；不修改 node_modules。
- 不影响既有数据（语言字段、片段内容不动）。

## Acceptance Criteria

- [ ] 右键菜单 / 下拉菜单内所有图标视觉尺寸一致（16px）
- [ ] 移入回收站、彻底删除 hover 时红底白字，文字清晰可读
- [ ] markdown 片段状态栏显示固定 "Markdown"，无语言选择器；其他片段语言列表不含 markdown
- [ ] 片段与笔记编辑器：光标行无灰色底；深色与浅色模式下选中文本背景清晰可辨
- [ ] npm run build 通过

## Notes

- 轻量 UI 修复任务，PRD-only。
- 复用项目既有颜色 token（destructive / destructive-foreground / 现有选中 rgba）。