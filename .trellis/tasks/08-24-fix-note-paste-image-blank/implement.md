# Implement —— 修复 md 笔记粘贴图片后完全空白

## 执行计划（有序）

### Step 1: 诊断日志版（先定位 H1-H4 落点）

在以下位置加临时 `console.log`（dev 模式运行，不覆盖 src 正式逻辑，验后即删）：

- `EditorPane.handlePasteImage`：`attachImage` 返回的 markdown / 插入成功
- `MarkdownEditor` 预取 effect：value diff / scan 出的 ids / 每个 id 的 url|null / cancelled 状态
- `attachment.imageToBlobUrl`：attId、data 长度、blob type
- `imageBlocks resolve`：src、映射结果的类型（string|null|undefined）

验证命令：
```
docker：用户 uTools 开发者工具 → 加载 public/（HMR）→ 粘贴图片 → Alt+Z 看 Console
```

退出条件：拿到一次完整日志链（插入 → 预取 → resolve → 渲染）。

### Step 2: 按根因修复

- H1 成立（getAttachment null）：查附件 id 与写入是否一致（check db.ts putImageAttachment id 拼接）；若 uTools 侧原因（如 id 法规/长度/字符限制），调整 id 方案并保持 att:// 兼容
- H2 成立（竞态）：按 design §1 重构为 ensureBlobs 幂等预取
- H3 成立（Blob 失效）：修 imageToBlobUrl（如 `new Blob([data.buffer], ...)` 或编码修正）
- H4 成立（正则吞 URL）：修 image-blocks 中 Image 提取正则

### Step 3: 兜底改造（无论根因何落点均做）

- `imageBlocks` resolve null → 占位 widget（loading/error 双态）
- 预取错误重试 ≤3 次 + pending 去重

### Step 4: 验证 & 质量门（✅ 已完成）

- [x] npm run build（tsc -b + vite build 通过）
- [x] 实机验证（用户）：粘贴图片正常显示、占位→真图过渡正常
- [x] 所有 `[img-debug]` 临时日志已清除（rg 确认无残留），复编译 tsc 通过

### Step 5: 收尾

- 全程不 commit（用户显式要求时再提交）
- spec 沉淀（若发现 uTools 附件 id/API 坑 → trellis-update-spec）

## 回滚点

- 每 Step 一个 commit 粒度；Step 2/3 可在独立分支进行，异常 revert 单步
