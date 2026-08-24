# PRD —— 修复 md 笔记粘贴图片后无法显示（完全空白）

## 背景

Pattern Vault 的 Markdown 笔记编辑器（二期即时渲染模式）在粘贴图片后，编辑区中对应位置**完全空白**：既看不到 `![](att://...)` 源码，也看不到渲染出来的图片。

用户已确认的症状：

- 编辑器对应位置完全空白（源码行也看不到，光标移到该行时源码出现）
- 粘贴后**立即**不显示，无需切换记录/重启
- uTools 开发者工具 Console 无红色报错

## 现状链路（插入图片全流程）

```
Ctrl+V 粘贴(剪贴板 image)
  → MarkdownEditor handlePaste(CM 监听) 拦截
  → EditorPane.handlePasteImage:
      file.arrayBuffer() → attachImage(record._id, buffer, mime)
      → putImageAttachment → utools.db.promises.postAttachment(id, data, mime)
      → id = `pattern/<patternId>/img-<ts>`
      → 返回 markdown `![](att://<id>)`
  → codeRef.insert(`\n![](att://...)\n`)          // 插入 CM 文档
  → updateListener → onChange → patchFragment → store
  → value prop 变化 → MarkdownEditor 预取 effect:
      scanAttachmentRefs(value) → imageToBlobUrl(id)
      → getAttachment(i) → Blob → URL.createObjectURL
      → blobMap.set(id, url) → dispatch imageBlocksRefreshEffect
  → imageBlocks 重建 decorations:
      resolveImage(att://) → blobMap.get(id) ?? null
      → null 跳过 widget（回退源码显示）
```

## 症状的最可能机制

- `inline-preview`（官方）对**非光标行**图片源码做 `pushReplace` 隐藏（Obsidian 模式：图片块 + 源码行二选一显示）。
- 本项目 `imageBlocks` 仿写版配置 `resolve`：`att://` 未预取到 blob 时返回 `null` → 跳过 widget。
- 两者叠加 ⇒ **widget 未渲染 + 源码被隐藏 = 编辑区完全空白**。
- 因此根因收敛到「blob 预取失败 / 未命中」：`blobMap` 中没有该 att id 的 blob URL。

## 已知的强嫌疑点（待验证，非结论）

1. `imageToBlobUrl` 返回 `null`（`getAttachment` 取不到附件 / id 不匹配）。
2. 预取 effect 的 cancel 竞态使 `map.set` 永远未执行（理论会收敛，需实测）。
3. `resolve` 闭包捕获的是 mount 时的 `blobMapRef` —— 设计上 ref 是稳定的，但需确认 `imageBlocks` 扩展与预取 effect 是否共享同一 ref 引用。
4. blob URL 在 uTools 环境 img 加载失败（CSP/协议）——但控制台无报错，权重低。
5. `ATT_REF_RE` / `Image` 节点匹配对 `att://` URL 的兼容性（URL 含 `:`、`/`）。
6. 预取 effect 未运行（onChange→store→value 链路中断）。

## 需求

1. 粘贴图片后，编辑区在附件落库后尽快（要求：1 秒内，正常 <500ms）显示图片块。
2. 图片显示不依赖光标位置：光标在其他行时图片块可见（Obsidian 语义），光标移回源码行时源码可见。
3. 切换记录/重启插件后重新打开笔记，图片仍能显示（blob 重新预取）。
4. 修复**不能**以「取消 inline-preview 的源码隐藏」为方案（那会让图片行永远显示源码，破坏 Obsidian 模式观感）；临时补丁可以但需记录。
5. 不改变附件存储格式（`att://<id>` 引用协议保持不变，兼容已有数据）。

## 验收标准

- [ ] 粘贴一张 ≥50KB 的真实截图到新笔记，编辑区空白行处出现图片（最大图片宽度不超编辑器列宽）。
- [ ] 光标移开/移回图片行，源码隐藏/显示行为符合 Obsidian 模式（图片块始终在行下方）。
- [ ] 重新打开该笔记（切换记录或重启 uTools），图片正常显示。
- [ ] 连续粘贴 3 张图（快速），全部正常显示，无空白、无重复、无错位。
- [ ] 覆盖场景：粘贴时光标在空行 / 有内容行 / 文档末尾。
- [ ] 回归：普通网络图片语法 `![](https://...)` 行为不变；表格内图片不受影响。
- [ ] 控制台无新增报错。

## 研究区（在任务 research/ 目录沉淀证据）

- 根因验证实验结果（日志版跑出的链路输出）
- uTools 附件 id 规则 / `getAttachment` 行为确认来源
