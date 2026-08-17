# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

### 数据层异常必须真实传播，禁止吞异常

**Symptom**: 保存失败但状态栏显示"已保存✓"（数据实际未落库）

**Cause**: store 层 `.catch(() => {})` 吞掉 reject，且 db 函数本身无 try/catch，put 失败时 Promise reject 被静默吞掉

**Fix**: 数据层（db 封装）函数统一 try/catch 并返回明确结果（`Promise<boolean>` / `[]`）；调用方根据返回值驱动 UI 状态（saved / error），不依赖 catch 分支

```ts
// Correct —— db 层返回结果，UI 依据结果显示
export async function savePattern(record: PatternRecord): Promise<boolean> {
  try {
    const r = await services.db.put(record)
    return r.ok
  } catch {
    return false
  }
}
// store: const ok = await savePattern(rec); set({ saveState: ok ? 'saved' : 'error' })
```

**Prevention**: 检查清单——① 每个 db 函数都有 try/catch 且返回结果；② 没有任何 `.catch(() => {})` 吞掉写库失败；③ "保存成功"类 UI 状态必须由写库返回值驱动

---

## Required Patterns

### uTools 老内核禁止用 Tailwind opacity 修饰符（`/60` 等）改颜色

**Symptom**: 写了 `text-muted-foreground/60` 但颜色完全没变化（看起来像没改）。

**Cause**: Tailwind 4 的 `/60` 透明修饰符编译成 `color: color-mix(in oklab, ...)`。uTools 3 内核（Chrome 88）不支持 `color-mix()`，且 Lightnings CSS 无法把"变量 + color-mix"降级为 hex → 整条声明被丢弃，颜色保持原样。

**Fix**: 用标准 `opacity` 属性代替颜色透明度修饰符（Chrome 88 原生支持，Lightning CSS 直接保留）：

```tsx
// Wrong —— 编译成 color-mix()，老内核丢弃 → 颜色不变
<span className="text-muted-foreground/60">Ctrl+1</span>

// Correct —— 标准 opacity 属性，老内核直接生效
<span className="text-muted-foreground opacity-60">Ctrl+1</span>
```

**Prevention**: 需要"颜色变浅"时，优先用 `opacity-X`；只有固定色值（非 CSS 变量）才可安全用 `/X` 修饰符。注意：Lightning CSS 能降级字面量色（如 `bg-red-500/50` → rgba），但**CSS 变量**（`text-muted-foreground/60` = `var(--muted-foreground)`）降级不了。

---

### 删除文件夹 = 记录移入回收站并清空归属

**Symptom**: 删除分类后，其下记录在回收站恢复后变成"无归属"，但若保留 `categoryId` 会指向已删除分类 → 记录在"所有"视图可见、却不在任何文件夹/收件箱视图 → 用户找不到。

**Fix**: `moveCategoryToTrash` 同时将记录 `deleted=true` 且 `categoryId=null`（恢复后落收件箱）：

```ts
// Correct —— 分类删除时清空归属，避免悬空引用
moveCategoryToTrash: async (categoryId) => {
  const affected = records.filter((r) => r.categoryId === categoryId && !r.deleted)
  for (const r of affected) {
    r.deleted = true
    r.categoryId = null
    r.updatedAt = Date.now()
  }
  await enqueue(() => Promise.all(affected.map((r) => savePattern(r))))
}
```

---

### 标签"从所有记录移除"必须包含回收站记录

**Symptom**: 删除标签后，回收站里挂着该标签的记录恢复时标签"复活"。

**Fix**: 遍历**全部**记录（含 `deleted`），不按 `!r.deleted` 过滤；确认框计数同理：

```ts
// Wrong —— 只处理未删除记录，回收站记录残留标签
records.filter((r) => !r.deleted && r.tags.includes(tag))

// Correct —— 含回收站记录
records.filter((r) => r.tags.includes(tag))
```

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)
