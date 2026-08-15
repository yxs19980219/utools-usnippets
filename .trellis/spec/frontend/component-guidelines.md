# Component Guidelines

> How components are built in this project.

---

## Overview

<!--
Document your project's component conventions here.

Questions to answer:
- What component patterns do you use?
- How are props defined?
- How do you handle composition?
- What accessibility standards apply?
-->

(To be filled by the team)

---

## Component Structure

<!-- Standard structure of a component file -->

(To be filled by the team)

---

## Props Conventions

<!-- How props should be defined and typed -->

(To be filled by the team)

---

## Styling Patterns

<!-- How styles are applied (CSS modules, styled-components, Tailwind, etc.) -->

(To be filled by the team)

---

## Accessibility

<!-- A11y requirements and patterns -->

(To be filled by the team)

---

## Design Decision: 编辑器用 atomic 底层组合而非 React wrapper

**Context**: 二期需要把 markdown 编辑器升级为 Obsidian 式即时渲染（@atomic-editor/editor）。官方提供 React wrapper（`AtomicEditor`），但它无法注入自定义图片 resolver（图片需从 utools.db 附件异步解析为 blob URL），且 wrapper 不支持 live-md math 扩展的按需 import 与 tree-shake。

**Options Considered**:
1. `@atomic-editor/react` wrapper —— API 简单，但无法注入 `resolveImage`，图片就地渲染不可行
2. **底层组合（采用）**：`EditorView` + `EditorState.create` 手动装配 extensions

**Decision**: 采用底层组合。模式要点（`src/components/editor/MarkdownEditor.tsx`）：

```tsx
// 1. 扩展一次性挂载（useEffect []），resolver 闭包引用 ref（blobMapRef），
//    内容可增量更新而无需重建扩展
// 2. 记录切换用父组件 key 重建（documentId 语义）：
//    <MarkdownEditor key={`${record._id}:${fragment.id}`} ... />
//    替代 value-sync，undo/光标按记录隔离
// 3. 对外接口与 CodeBlock 对齐（value/onChange/language/onPasteImage/dark + insert/focus handle）
```

**Extensibility**: 新增扩展 = 在 `extensions` 数组追加；需要动态行为时用 `Compartment.reconfigure` 或父组件 key 重建。

---

## Design Decision: 编辑器组件按语言路由，CodeBlock 保持不动

**Context**: 二期只升级 markdown 语言，其余语言（js/sql/python...）必须零回归。

**Decision**: `EditorPane.tsx` 内 `language === 'markdown'` → `<MarkdownEditor>`（lazy + Suspense 拆分 chunk，非 markdown 用户零增量），其余 → `<CodeBlock>`。CodeBlock 对外接口与内部实现不动。新增语言专属组件时遵循此模式，不要改已有组件的分支结构。

---

## Common Mistakes

### data-theme 必须挂在 atomic 编辑器的祖先元素上

**Symptom**: 浅色主题下 markdown 编辑器文字全灰看不见（白底 + 暗色默认浅灰字 `#dcddde`）

**Cause**: atomic 的浅色变量组选择器是**后代选择器** `[data-theme="light"] .atomic-cm-editor`，要求 data-theme 在**祖先**元素。如果把 `data-theme` 和 `atomic-cm-editor` class 放**同一个** div 上，选择器永不匹配，浅色变量不生效。

```tsx
// Wrong —— data-theme 与 atomic-cm-editor 同元素
<div data-theme="light" className="atomic-cm-editor" />

// Correct —— data-theme 放外层祖先
<div data-theme="light">
  <div className="atomic-cm-editor" />
</div>
```

**Prevention**: 挂载 atomic 编辑器时，先确认 `data-theme` 在 class 的祖先链上。

### 全局 .cm-editor 样式会泄漏到 atomic 编辑器

**Symptom**: 输入行出现一期遗留的背景色（`.cm-editor .cm-activeLine { background: var(--accent) }`），atomic 主题的 `transparent` 被全局规则覆盖

**Cause**: globals.css 的 `.cm-editor` 通用规则（activeLine 背景、gutters 等）同样命中 atomic 编辑器（它也是 `.cm-editor`），特异性/顺序上压过 atomic 主题。

**Fix**: 用更高特异性选择器覆盖（`globals.css`）:

```css
.atomic-cm-editor.cm-editor .cm-activeLine,
.atomic-cm-editor.cm-editor .cm-activeLineGutter {
  background: transparent;
}
```

**Prevention**: 新增 atomic 相关全局覆盖时，选择器一律带 `.atomic-cm-editor.cm-editor` 前缀确保特异性。

### React Hooks 顺序违规（条件 return 前的 hooks 缺失）

**Symptom**: 记录被删除/外部同步后组件崩溃，报错 "Rendered fewer hooks than expected"

**Cause**: `useMemo`/`useState` 等 hooks 写在 `if (!record) return null` 条件 return 之后。当 props 变成 undefined 时，hooks 数量从 10 变 9，React 抛运行时异常

**Fix**: 所有 hooks 前置（无条件执行），条件 return 合并后移

```tsx
// Wrong —— useMemo 在条件 return 之后
function EditorPane({ record }: Props) {
  if (!record) return null
  const lineCount = useMemo(() => count(record), [record]) // 崩溃!
}

// Correct —— hooks 全部前置
function EditorPane({ record }: Props) {
  const lineCount = useMemo(() => (record ? count(record) : 0), [record])
  if (!record) return null
}
```

**Prevention**: 规则：**组件内所有 hooks 必须无条件执行**，条件返回只能在全部 hooks 之后
