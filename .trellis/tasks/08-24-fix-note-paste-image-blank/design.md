# Design —— 修复 md 笔记粘贴图片后完全空白

## 问题定性

症状链条（从已有代码可静态确认的）:

```
① 粘贴 → 附件落库 → insert(`\n![](att://<id>)\n`)     [已确认工作：用户能插入]
② inline-preview（官方，node_modules 内）对非光标行图片源码 pushReplace 隐藏
③ 本项目 imageBlocks 仿写版：resolve(att://) 返回 null ⇒ 跳过 widget（回退源码显示）
④ ②+③ 叠加 ⇒ 源码被隐藏且无 widget ⇒ 编辑区"完全空白"（用户观察属实）
```

根因收敛到 **③ 的输入——blob 预取未命中**（`blobMap` 无该 id 的 blob URL），
因为 ① 里插入成功意味着 `postAttachment` OK（否则 toast"图片保存失败"）。
控制台无报错 ⇒ 无未捕获异常；`getAttachment` 疑似返回 null（- 静默）或预取竞态/未执行。

**完全空白是"设计级"形态**：即使预取只是**慢**（500ms+），用户也只见空白 ——
没有加载中/占位/错误提示。这是体验缺陷，修复时一并兜底。

## 根因确认（实机日志 2026-08-24）

```
[img-debug] prefetch effect { valueLen: 12, missing: [] }        # 粘贴前，正常
[img-debug] paste inserted    { markdown: "![](att://pattern/839622e9-.../img-1787538742003)" }
[img-debug] resolve           { src: "att://pattern/.../img-...", hit: "null" }   # blob 未命中
[img-debug] prefetch effect { valueLen: 87, missing: [] }        # 插入后仍空！预取从未发起
```

日志特征：**`blob ready` 从未出现** ⇒ 预取 effect 在插入后（valueLen 87）扫描 `missing: []`
⇒ `scanAttachmentRefs` 返回空。

Node 对 `ATT_REF_RE` + 相同正文独立验证：正则、字符串均匹配成功 ⇒ 断点不在正则本身。

### 根因：scanAttachmentRefs 与 resolveAttRef 的接口错配

```js
// src/types.ts —— 捕获组只收 id（已剥掉 att:// 前缀）
ATT_REF_RE = /!\[[^\]]*\]\(att:\/\/([^)]+)\)/g

// src/lib/attachment.ts
resolveAttRef(ref) { return ref.match(/^att:\/\/(.+)$/) }   // 期望含 att:// 前缀
scanAttachmentRefs(content) {
  for (const m of content.matchAll(ATT_REF_RE)) {
    const id = resolveAttRef(m[1])   // m[1] 无 att:// 前缀 ⇒ 永远 null ⇒ 空集
    ...
  }
}
```

`m[1]` 已剥离前缀，喂给期望含前缀的 `resolveAttRef` ⇒ 恒 null ⇒ 预取空白 ⇒ 图片永不渲染。

**连带失效的调用方**（同根因）：`records.deleteForever` 孤儿附件清理（泄漏）、
`import-export` 附件枚举、`export-images` 导出图片。

### 修复（已完成并实机验证 2026-08-24）

1. `ATT_REF_RE` 捕获组改为包含完整 `att://` URI，`resolveAttRef` 职责不变（单一职责在型号）
2. `imageBlocks` resolve null（blob 预取中）→ 渲染"图片加载中"占位 widget，替代"跳过 widget"
   —— 修复后首次插入仍存在小于预取耗时的瞬间窗口（resolve 先于 blob 就绪），
   跳过 widget + inline-preview 隐藏源码 = 该瞬间仍会"空白闪一下"；占位 widget 消除该形态

**实机验证**：粘贴图片正常显示；预取/渲染链路日志链齐（blob ready → resolve hit）；
干扰项为用户误往代码片段粘贴（片段不渲染图片为预期行为，非 bug）。

## 根因假设（顺序即怀疑权重，H1/H2/H3 已排除）

| # | 假设 | 证据/疑点 | 验证手段 |
|---|------|-----------|----------|
| H1 | `getAttachment(id)` 返回 null（附件实际未落库 / id 不一致） | postAttachment 成功=用户能 insert；get null 是唯一静默路径 | 控制台直接调 `utools.db.promises.getAttachment('<id>')` |
| H2 | 预取 effect 被 cancel 竞态反复打断，map 从未 set | MarkdownEditor 预取 effect 有 cancelled flag + 每 value 变重新发起 | 临时日志（见 implement 第 1 步） |
| H3 | getAttachment 返回的 Uint8Array 经 Blob 封装后 img 无法解码（类型/编码问题） | 控制台无报错，概率低 | 检查 data.length 与 blob.type |
| H4 | image-blocks 的 Image 节点正则对 `att://` URL 提取失败 | 正则 `[^\s)"']+` 理论可匹配（验证中） | 日志 resolve 调用入参 |

## 修复方案（分层）

### 1. 确定性预取（替换"value 驱动的单次预取"）——【降级为待观察项】

实际诊断（2026-08-24 实机日志）证明根因不在此层：**`scanAttachmentRefs` 与 `resolveAttRef`
接口错配，预取扫描从未返回任何 id**（见 §根因确认）。修复后预取路径立即恢复，
cancel 竞态实测会收敛（同一 id 每次 value 变化重发，最后一次必成功）。
**pending 去重 + 失败重试暂不做**（YAGNI，实测无抖动再补）。

### 2. resolve 未命中改走"占位 widget"而非"跳过"

现状：`resolve === null` → `return`（跳过）→ inline-preview 已隐藏源码 → 空白。
改为：

- resolve 返回 `null`（未就绪）→ 渲染占位 widget（`cm-atomic-image cm-atomic-image-loading`：灰底 + "图片加载中…"或图标）
- resolve 返回 string → 图片 widget（现状行为）
- 附件取不到（重试耗尽）→ 渲染错误占位（"图片加载失败"，点开显源码行）；**同时保证源码行可见**——占位 widget 上做点击跳转源行（现有 mousedown 逻辑复用）
- 不改变 inline-preview 行为（源码隐藏仍由光标活跃行控制，Obsidian 语义不变）

**边界**：不在 image-blocks.ts 里耦合"重试"逻辑 —— 预取重试在 MarkdownEditor（数据层），image-blocks 只负责"resolve 结果 → 何种 widget"（视图层）。

### 3. 兼容与回滚

- `att://` 格式、附件 id 规则不变（存量数据零迁移）
- 网络图（undefined 直通）行为不变；表格内图片（Table 父节点跳过）不变
- 回滚点：git commit 粒度；本改动集中在 3 个文件，异常可整体 revert

## 不在 scope

- 改粘贴放行的顺序（先插入占位 inline 再换附件）——留二期，本任务只修"存后显示"
- inline-preview 源码隐藏逻辑（官方包内，不可修改，改也是靠 resolve 侧解决）
- 图片拖拽插入（无该入口，粘贴是唯一入径）

## 涉及文件

- `src/lib/atomic/image-blocks.ts`（resolve null 语义 → 占位 widget）
- `src/components/editor/MarkdownEditor.tsx`（预取重构 ensureBlobs + 重试）
- `src/lib/attachment.ts`（可能加 getAttachment>Blob 失败兜底/日志）
