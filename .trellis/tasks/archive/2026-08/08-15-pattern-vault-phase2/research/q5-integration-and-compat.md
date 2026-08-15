# Research: Q5+Q6 — 集成路径 + 体积与老内核风险

- **Query**: CodeBlock 边界内最小改动方案;bundle 体积影响;Chrome 88 兼容风险点
- **Scope**: internal(src/components/editor/CodeBlock.tsx, attachment.ts, vite.config.ts)+ external 体积数据
- **Date**: 2026-08-15

## Findings

### 集成路径(CodeBlock 边界内)

一期 CodeBlock.tsx 头注释已预留二期边界:"markdown 语言替换 atomic 只动本组件内部;对外接口保持 value / onChange / language / onPasteImage"。

**最小改动方案**:

```
CodeBlock.tsx
├─ language !== 'markdown' → 现有 CM6 分支(不动)
└─ language === 'markdown' → 新分支(建议拆独立组件 src/components/editor/MarkdownBlock.tsx):
   ├─ 底层组合原子扩展(见 q4 推荐栈),不用 AtomicCodeMirrorEditor wrapper
   ├─ 对外接口对齐:
   │    value          → markdownSource(仅 mount 用,后续 doc 为准;切换记录用 documentId 语义
   │                      —— 即一期 value 同步 effect 的等价物:按记录 id 重建 view)
   │    onChange       → onMarkdownChange(updateListener 已内置,直接接 onChangeRef)
   │    onPasteImage   → 复用一期 view.dom.addEventListener('paste') 拦截逻辑
   │    dark           → 覆盖 --atomic-editor-* 变量(方案:在容器上设置 data-theme 或 CSS 变量组)
   ├─ 图片:
   │    进入记录时 scanAttachmentRefs(content) → 批量 imageToBlobUrl → Map<attId, blobUrl>
   │    resolver = (src) => resolveAttRef(src) ? map.get(resolveAttRef(src)) : null
   │    Map 经 ref 传入(扩展一次性捕获约束,q1)
   ├─ 公式:
   │    import { mathPlugin, blockMathField } from 'codemirror-live-markdown'
   │    import katex from 'katex'; (window.katex = katex)  —— 或复制 renderMath 直接 import
   └─ 样式:import '@atomic-editor/editor/styles.css' + katex.min.css(注意 Vite 资源路径)
```

**关键点**:
1. 记录切换:atomic 的 documentId 语义 = 一期 value-sync effect 的替代(换 documentId 重建 view,天然隔离 undo/光标)。父组件按记录 id 传 `key` 或 documentId 即可,无需手动 dispatch 全量替换。
2. 语言切换(同一条记录从 markdown 切到其他语言):现有 `languageCompartment.reconfigure` 模式不适用于 atomic(它内部是独立 EditorView)——**markdown 分支用独立组件挂载/卸载即可**,React 条件渲染天然处理。
3. 粘贴图片拦截逻辑一期已有(CodeBlock.tsx:167-183),原子组件内复制该模式。
4. 图片 blob 预取时机:进入记录 → 与自动保存/正文加载同生命周期;失败(附件缺失)时 resolver 返回 null → 显示 raw markdown(参考 fedoup 语义)。

### 体积影响(估算)

| 增量项 | gzip 估算 | 说明 |
|---|---|---|
| @atomic-editor/editor(JS) | ~55-65KB | 209KB unpacked 的 JS 压缩(可再减:tables/wiki-links 用不到的部分可被 tree-shake,实际可能更低) |
| codemirror-live-markdown(math 闭包) | ~5-10KB | 单文件 1.7MB,但按需 import 只带 math 相关闭包 |
| katex | ~85-95KB | 0.18.4:js 265.8KB + css 24.1KB 压缩后;含字体 woff2 资源 |
| 仿写 imageBlocks + resolver | ~3KB | 本地代码 |
| @codemirror/autocomplete | ~5KB | 一期未装,atomic wrapper/组装需要(closeBrackets) |
| **合计增量** | **~155-175KB gzip** | 不含一期已有 CM6;若仅 markdown tab 动态 import,非 markdown 用户零增量 |

优化选项:KaTeX 与 atomic 均可放在 markdown 分支的动态 import(React.lazy / import() 在 language === 'markdown' 时加载),主包只增加 atomic 壳。

### Chrome 88 内核兼容风险点(逐项)

| 风险点 | 状态 | 处置 |
|---|---|---|
| atomic CSS color-mix(17 处) | Chrome 111+ 才支持 | Lightning CSS(targets chrome 88)静态求值无 var 的 12 处(在 var fallback 内,不生效);5 处裸用含 var → 原样输出 → 声明被忽略(视觉降级)。对策:覆盖 --atomic-editor-* 全部变量 + 手写 @supports fallback(或接受降级,受影响面小:选中行/链接/focus 背景) |
| atomic JS 语法 | ES2021 及以下(已静态检查) | 兼容 ✓ |
| KaTeX 0.18.4 | ES5 UMD 输出、CSS 传统 | 兼容 ✓ |
| blob URL(图片) | Chrome 88 原生支持 | ✓(一期 attachment.ts 已按此设计) |
| CSS 变量覆盖主题 | Chrome 88 支持 | ✓ |
| Vite build target | 未显式设置,默认 'modules'(≈chrome87+) | Chrome 88 ≥ 87 基本满足;但保险起见显式 `build.target: 'chrome88'`(vite.config 有 lightningcss chrome88 目标,JS target 建议同步) |
| @lezer/markdown 版本 | 一期 ^6.3.2,atomic peer ^1.0.0(lezer) | peer 满足;lang-markdown 的 devDeps 版本差(6.3 vs 6.5)风险低 |
| KaTeX 字体资源 | woff2 由 KaTeX 包提供 | 确认 Vite 打包后字体路径正确(KaTeX 用相对 url()) |

## Caveats

- 体积为估算值(基于 unpacked size 与常规压缩比),最终以 build 产物实测为准。
- 动态 import 拆分是建议而非必需;若一期 bundle 无体积敏感约束,直接静态引入亦可。
- 未实测 Chrome 88 下 atomic 表格 widget 的交互(点击单元格编辑)与 KaTeX 渲染的合体表现——实现阶段需在 uTools WebView 内过一遍验收。
