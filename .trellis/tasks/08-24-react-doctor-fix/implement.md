# Implement — 执行计划

## 前置

- 工作树必须 clean（当前已确认）；如出现未预期 dirty 先停下报告
- 基线扫描报告：`C:\Users\Fengzhi\AppData\Local\Temp\opencode\react-doctor-20260824\initial.json`（schema v3、0.9.12、scope=full、46 项）
- Tsc baseline：项目有 `npm run build`（tsc -b && vite build）；实现前先跑一次确认基线为绿

## 实施清单（按依赖顺序）

### 批次 A：Editor（error + 同源 ref 问题）
- [ ] A1. 读 CodeBlock.tsx / MarkdownEditor.tsx 相关段确认模式（已读 CodeBlock 全文，需补 MarkdownEditor 139 附近）
- [ ] A2. CodeBlock.tsx：latest-ref（onChangeRef/onPasteImageRef）移入 useEffect；2 个 Compartment 改 useState 惰性初始化
- [ ] A3. MarkdownEditor.tsx：同 A2 模式
- [ ] A4. 验证：`npm run build`

### 批次 B：清理类（先读后删/改）
- [ ] B1. grep `@lezer/lr` 全仓 → 无引用则删 package.json 依赖（package-lock 同步 npm uninstall）
- [ ] B2. grep badge / textarea 组件引用 → 无引用则删文件
- [ ] B3. grep servicesReady / previewSnippet / ATTACHMENT_PREFIX 引用 → 无则删导出
- [ ] B4. 读 button.tsx 非组件导出，评估 only-export-components 修法
- [ ] B5. `npm run build`

### 批次 C：算法性能（每处读上下文后修）
- [ ] C1. import-export.ts:67,175,184,189 — 确认迭代独立后 Promise.all
- [ ] C2. records.ts:161,204 — 同上；records.ts:159 — find-in-loop 改 Map（谓词等价性先确认）；若 159 与 161 同函数，一并设计（Map 可同时服务后续 find）
- [ ] C3. db.ts:23,60 — filter+map 合一趟
- [ ] C4. TagEditor.tsx:43、export-images.ts:40 — Set 化
- [ ] C5. attachment.ts:36 — 读调用方后闭合 URL 生命周期
- [ ] C6. SearchView.tsx:322 — 读数据流后修 effect 链
- [ ] C7. `npm run build`

### 批次 D：复扫验证
- [ ] D1. react-doctor 重扫（同版本 0.9.12、--scope full --json）：target 诊断全消失、无新诊断、4 errors → 0
- [ ] D2. 逐条确认验收标准（prd.md）
- [ ] D3. trellis-check 对改动做质量复核（lint/type、一致性）

## 回滚点

- 每批次完成后 `git status` 确认改动文件 = 预期集，可单独 `git restore <file>` 回滚
- 时序：批次 A 完成即 `npm run build` 通过才进 B（避免叠加 debug）

## 验证命令

- `npm run build`（tsc -b + vite build 全链路）
- `npx -y react-doctor@0.9.12 --json --blocking none --yes --scope full --no-telemetry`
- 重扫后与 initial.json 对比：残留项 = 原清单外的；新增项 = 回归
