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

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)
