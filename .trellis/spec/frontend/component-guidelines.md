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

## Common Mistakes

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
