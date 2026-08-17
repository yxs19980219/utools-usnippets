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

## Design Decision: 语言品牌图标来自 simple-icons 官方包（形状 + 品牌色随包维护）

**Context**: 搜索视图每条结果左侧需要语言标识。第一版用 lucide 通用语义图标（花括号/终端等），无语言辨识度；第二版引入 react-icons（Simple Icons 品牌集），但颜色是手抄的 hex 静态表（`LANGUAGE_BRAND`），换包版本/加新语言时颜色不会自动同步，且 Shell 等官方色曾抄错（`#FFE484` vs 官方 `#FFD500`）。

**Options Considered**:
1. react-icons（`react-icons/si`）—— 只有形状，无 hex 元数据，颜色仍需手维护
2. **simple-icons 官方包（采用）**：每个图标导出含 `title` / `slug` / `path`（矢量路径）/ `hex`（官方品牌色）/ `license`
3. 自绘 SVG —— 维护成本最高

**Decision**: 品牌图标一律从 `simple-icons` 命名导入（`siJavascript`、`siPython`…），形状与颜色都取自包内元数据，不手写颜色表。模式要点（`src/components/SearchView.tsx`）：

```tsx
// 1. 语言 → 图标对象映射（仅语义映射，无颜色）
const SIMPLE_ICONS: Record<string, SimpleIcon> = {
  javascript: siJavascript,
  python: siPython,
  // jsx → siReact（JSX 无独立品牌图标）
  // java → siOpenjdk（simple-icons 已移除 Java 商标，用 OpenJDK）
}

// 2. 品牌色 = 图标 hex 元数据；图标反色按 YIQ 亮度自动判断（浅底黑图标/深底白图标）
const brand = { bg: `#${icon.hex}`, fg: contrastFg(icon.hex) }

// 3. 无品牌语言兜底：FALLBACK_BRAND 自定义色（sql） + FALLBACK_ICONS lucide 语义图标（sql/plaintext）
```

**新增语言时的三处同步**（缺一不可）：
1. `src/lib/languages.ts` LANGUAGES（设置/状态栏下拉）
2. `src/components/editor/CodeBlock.tsx` languageExtension（编辑器高亮；官方包 `@codemirror/lang-*`，缺失时用 `@codemirror/legacy-modes` 的 StreamLanguage）
3. `src/components/SearchView.tsx` SIMPLE_ICONS（搜索视图徽标）

**Extensibility**: simple-icons 官方维护颜色与形状，升级包即可获得修正；打包验证过按需 import 可 tree-shake（3453 个图标只打入用到的）。

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

### 覆盖第三方样式表必须提高特异性（懒加载 chunk 顺序在 globals.css 之后）

**Symptom**: 在 globals.css 里想放大 markdown 标题字号，写 `.cm-line.cm-atomic-h1 { font-size: 1.6em }`（与源样式同特异性）完全不生效，标题仍是 atomic 默认的 1.35em

**Cause**: atomic 样式表（`@atomic-editor/editor/dist/styles/inline-preview.css`）由 MarkdownEditor **懒加载 chunk** 注入（MarkdownEditor.css），加载顺序晚于 globals.css（index chunk）。CSS 级联：同特异性下**后加载者赢**，所以源样式始终压过覆盖。

**Fix**: 选择器带 `.atomic-cm-editor` 前缀提高特异性（0,3,0 > 0,2,0），与加载顺序无关：

```css
/* Wrong —— 特异性 0,2,0 与源样式相同，懒加载顺序在后，永远被压 */
.cm-line.cm-atomic-h1 { font-size: 1.6em; }

/* Correct —— 特异性 0,3,0 压过源样式表，不受加载顺序影响 */
.atomic-cm-editor .cm-line.cm-atomic-h1 { font-size: 1.6em; }
```

当前维护的覆盖清单（globals.css，2026-08）：h1 1.6em / h2 1.35em / h3 1.2em / h4 1.1em / h5 1em / h6 0.9em，只改 font-size，weight/letter-spacing/uppercase 等其余样式继承源规则。

**Prevention**: 覆盖任何**懒加载组件**（lazy/Suspense 拆分 chunk）的内置样式时，检查源选择器的特异性并加前缀提高一级；只改必须覆盖的属性，其余交给源样式表。

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

---

## 教训：『像主界面一样顶部搜索框』= setSubInput + document 级 keydown（勿绕道 mainPush / 页面内输入框）

**Symptom**: 用户要求片段搜索视图"和主界面一样在最顶部用 uTools 的搜索功能"。主界面顶部即 `setSubInput` 原生子输入框。因误以为子输入框无法捕获键盘事件（方向键/回车/Ctrl+C），先后绕道页面内输入框、`onMainPush` 推送方案，多轮返工后才回到正确形态。

**Cause**: 两个错误假设：
1. 假设"uTools 子输入框只提供 onChange、无键盘事件"——**错**。子输入框虽是 uTools 原生渲染，但**焦点在子输入框时键盘事件仍会冒泡到页面的 `document`**，`document.addEventListener('keydown')` 即可捕获方向键/回车/组合键（参照 uTools 知名插件 uTools-Finder / uDict / uTools-ProcessKiller 的实现）。
2. 用户说"像 X 一样"时未照抄 X 的实现，凭术语联想发明了新架构。

**Fix**: 标准形态 = `setSubInput` 顶部原生搜索框 + 页面列表 + document 级 keydown：

```tsx
// SearchView 自注册/移除子输入框（与主界面一致）
useEffect(() => {
  window.utools?.setSubInput?.(({ text }) => setQuery(text), '搜索片段：…', true)
  return () => { window.utools?.removeSubInput?.() }
}, [])

// document 级键盘监听：子输入框焦点下页面仍能捕获按键
useEffect(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { /* 移动选中 */ }
    else if (e.key === 'Enter') { /* hideMainWindowPasteText */ }
    else if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) { /* copyText */ }
  }
  document.addEventListener('keydown', onKeyDown)
  return () => document.removeEventListener('keydown', onKeyDown)
}, [deps])
```

**Prevention**:
1. uTools 交互需求默认用 `setSubInput` + 页面列表；需要键盘操作（方向键/回车/组合键）→ **`document.addEventListener('keydown')`**，不要为此换输入方案
2. `onMainPush` 只用于"用户在主搜索框输入时推送结果"的场景（如翻译/计算器），且需用户在插件设置勾选"允许推送内容到搜索面板"，dev 调试不可靠——默认不用
3. 页面内 `<Input>` 仅在无法使用 uTools 子输入框的场景（如需要输入框内嵌在页面布局中）才考虑，视觉与原生不一致
4. 用户表述有歧义时先确认"具体是哪个插件的什么效果"，再动手，别凭术语联想
