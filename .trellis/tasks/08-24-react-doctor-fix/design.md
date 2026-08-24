# Design — react-doctor 诊断修复

## 修复模式（按规则级）

### 1. no-ref-current-in-render + rerender-lazy-ref-init（Editor 两组件）

现状问题（CodeBlock.tsx refs）：
1. 渲染期写 ref：`onChangeRef.current = onChange` / `onPasteImageRef.current = onPasteImage`（latest-ref 模式）— React 19 严格模式/重放渲染会泄漏突变
2. `useRef(new Compartment())` 每次渲染重建对象再丢弃

修复：
- latest-ref 同步移入 `useEffect(() => { onChangeRef.current = onChange; onPasteImageRef.current = onPasteImage })`，无 deps 保持每次 commits 后同步
- Compartment 稳定实例改用 `useState(() => new Compartment())`（惰性初始化，跨渲染稳定，且不是 ref 突变）
- MarkdownEditor.tsx:139-140 同模式处理

取舍：ref 值在 effect 后才更新——本组件 getter 只在事件处理器（updateListener、paste handler）中消费，effect 在 commit 后、任何被动事件前运行，时序安全。

### 2. async-await-in-loop（import-export.ts ×4、records.ts ×2）

规则主张：循环内 await 串行化。修复前提：每次迭代的调用相互独立（无顺序依赖、无共享副作用依赖前次结果）。统一改为 `await Promise.all(items.map(iter))`。
- 若某处迭代本身需要限量并发或顺序依赖：保留串行，记录为 Observation（验收时说明）
- 实现时逐处确认独立性再改

### 3. js-combine-iterations（db.ts:23,60）

`.filter().map()` 两趟改为单趟 for-of（一次 push）同一数组。

### 4. js-index-maps（records.ts:159）

循环内 `array.find()` → 循环前构建 `Map`（key 由原 find 谓词决定），循环内 map 查找。find 谓词不是恒等 key 时：用 Map<key, item> 前先确认谓词与单一 key 等价；否则记录 Observation。

### 5. js-set-map-lookups（TagEditor.tsx:43、export-images.ts:40）

循环内 `array.includes()` → 循环前 `new Set(array)`。

### 6. no-create-object-url-without-revoke（attachment.ts:36）

`URL.createObjectURL` 后没有 provable revoke。修复：确保 URL 生命周期闭合（使用的调用方完成时 revoke；或模块内管理 registry），保持现有功能语义（图片附件预览需要 URL 存活到组件卸载/替换时）——需要先读 attachment.ts 与调用方，选最小闭合方式，必要时记录 Observation。

### 7. no-effect-chain（SearchView.tsx:322）

一个 effect 改 `activeIndex` 触发另一个 effect 级联重绘。先读代码确认数据流，最小修法通常是：合并触发链（在源头 effect 内直接完成结果计算），或让下游 effect 依赖上游意图而非中间状态。若结构限制无法低风险修复：保留并记录 Observation。

### 8. 清理类

- package.json 移除 `@lezer/lr`（先 grep 无引用）
- badge.tsx、textarea.tsx 整个文件删除（先 grep 无引用；删除后 only-export-components 在 badge.tsx 条目影消）
- 3 个 unused-export：删导出（先 grep 全仓无引用；若类型/常量被 .d.ts 或外部包引用则保留并记录）
- button.tsx:54 only-export-components：先读该导出内容
  - 若是 shadcn 风格导出（如 `cn` 等工具），移至独立工具文件
  - 若移除风险高：记录 Observation
- 视觉：全部改动不改变任何 UI 内外观与交互；删除文件确保无 import

## 兼容性与回滚

- 无 API/对外契约变化（仅源码内部）
- 每文件改动是局部的；回滚 = git 恢复该文件（工作树当前 clean，无用户未提交改动）
- 行为验证：`npm run build` + 手动走查编辑器（语言切换、粘贴图片、搜索）限于可用性，构建通过为准
