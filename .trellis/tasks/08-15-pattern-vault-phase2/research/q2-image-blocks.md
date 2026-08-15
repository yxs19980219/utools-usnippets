# Research: Q2 — 图片就地渲染接入点(att:// → blob)

- **Query**: atomic 的 imageBlocks 是否支持自定义 URL 解析?还是要自定义 widget?fedoup 的 imageResolver 可否参考?
- **Scope**: external(atomic/fedoup 源码)+ internal(attachment.ts)
- **Date**: 2026-08-15

## Findings

### atomic 内置 imageBlocks:无 URL 解析钩子,且无法禁用

- `imageBlocks()` 是**无参数函数**(dist/image-blocks.d.ts:3 `declare function imageBlocks(): Extension`)。
- 内部 `ImageWidget.toDOM` 直接 `img.src = this.src`(dist/image-blocks.js:60)——markdown 里的 `att://...` 会被原样塞进 `<img src>`,必然加载失败。
- React wrapper 硬编码 `imageBlocks()`(AtomicCodeMirrorEditor.js:134),**没有任何 prop 可禁用或替换它**。
- 若在 wrapper 之上叠加自定义图片 widget:内置 widget 仍会基于语法树渲染(破图 + 自定义 widget 双渲染),不可接受。

### 必须走"底层组合"路线(官方支持)

README "Low-level composition" 明文支持不用 React wrapper 自行组装:

```ts
import {
  inlinePreview,   // live preview decorations
  imageBlocks,     // rendered image widgets
  tables,          // WYSIWYG table widget
  atomicEditorTheme,
  atomicMarkdownSyntax,
} from '@atomic-editor/editor'
```

所有模块从主入口导出(`"."` export),`sideEffects` 仅声明 `**/*.css`,未用模块可被 Vite/Rollup tree-shake。

### 仿写 imageBlocks 的最小改造点(官方实现可作模板)

官方实现结构(dist/image-blocks.js,~233 行,源码已通读):

1. `buildImageBlocks(state)`: `ensureSyntaxTree(state, doc.length, 200)` 保证全文解析 → `tree.iterate` 找 `Image` 节点 → 跳过 `Table` 内图片 → 正则切出 `alt/src` → `Decoration.widget({ widget: new ImageWidget(src, alt), block: true, side: 1 }).range(line.to)`(图片渲染在源码行下方,Obsidian 模式)。
2. `changeAffectsImages(tr, existing)` 窄化失效:仅当变更触及已有图片 decoration 或变更行含 `![` 时才全量重建(普通打字 O(change),不 O(doc))。
3. `imageBlocksField`(StateField)处理 `treeGrowthEffect` 与映射。
4. `imageBlocks()` 返回 `[imageBlocksField, treeProgressPlugin]`。
5. 尺寸缓存 `dimensionCache`(Map<src,{w,h}>)防 CM6 虚拟化重挂载抖动;点击图片 → 光标回源行(用 `view.posAtDOM`)。

**改造方案(约 30-50 行 diff)**:给 `imageBlocks` 加配置项 `imageBlocks({ resolve?: (src: string) => string | null })`,`ImageWidget.toDOM` 中 `img.src = resolve(this.src) ?? this.src`;`dimensionCache` 的 key 沿用原始 src。att:// 解析失败(resolve 返回 null)时回退原 src(破图)或渲染占位。

### fedoup imageResolver 模式(可参考的 API 设计)

`@fedoup/markdown-editor`(0.1.0,MIT):
- `livePreviewPlugin({ imageResolver })` / `MarkdownEditor` prop `imageResolver?: (src: string) => string | null | undefined`(dist/index.d.ts:80,164)。
- **同步函数**:返回新 src 则用新 src;返回 null/undefined 则跳过 widget、回退 raw markdown 样式。
- 实现(源码 dist/index.js:137):`h = s.imageResolver ? s.imageResolver(g) : g` 直接替换。
- 我们的场景:utools.db 取附件是异步的 → 模式为"**先异步批量预取(scanAttachmentRefs → imageToBlobUrl)填充 Map<attId, blobUrl>,resolver 同步查 Map**"。blob URL 本身同步创建(URL.createObjectURL),Chrome 88 支持。

### 一期已有资产(可直接复用)

`src/lib/attachment.ts`:
- `scanAttachmentRefs(content)` — 扫正文取全部附件 id;
- `imageToBlobUrl(attId)` — 附件 → blob URL(一期预留的二期渲染入口,注释明示);
- `ATT_REF_RE` 引用正则(src/types)。
- 建议:进入记录/渲染前调用 `scanAttachmentRefs` 批量 `imageToBlobUrl`,Map 经 ref 传入 resolver(注意 atomic extensions 一次性捕获的约束,见 q1)。

### 其他方案的对比

| 方案 | 可行性 | 说明 |
|---|---|---|
| atomic wrapper + extensions 叠加自定义 widget | ✗ | 内置 imageBlocks 无法禁用 → 双渲染 |
| 底层组合 + 仿写 imageBlocks(resolver) | ✓ 推荐 | 官方实现作模板,改动小,官方架构支持 |
| 给上游提 PR(`imageBlocks({ resolve })`) | 远期 | 上游活跃,可作为长期收敛路径,但不阻塞二期 |
| codemirror-live-markdown 的 imageField | ✗ | `resolveImagePath(src, basePath)` 只做 basePath 字符串拼接(live-md dist:53399),**不支持函数注入**,blob URL 每图唯一无法拼接 |
| fedoup 整体替换 | 见 q4 | 无表格/公式,不满足需求 |

## Caveats

- 表格单元格内的图片:官方实现跳过(`Table` 祖先),表格 widget 内部自渲染——仿写时保持该行为。
- blob URL 生命周期(何时 revoke)需实现阶段决策;imageBlocks 的 dimensionCache 按 src 缓存,若 blob URL 变更(重新生成)会残留旧缓存,注意清理。
