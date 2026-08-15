# Research: Q4 — 备选方案对比与推荐组合

- **Query**: 若 atomic + math 组合不成立,备选方案评估;给出推荐组合 + 理由 + 风险
- **Scope**: external(三库源码/文档对比)
- **Date**: 2026-08-15

## Findings

### 方案矩阵

| 方案 | 标题/列表/引用 | 图片 att:// | 公式 | 表格 | 成本 | 结论 |
|---|---|---|---|---|---|---|
| **A. atomic 底层组合 + live-md math + 仿写 imageBlocks** | ✓ atomic | ✓ 仿写 resolver | ✓ live-md mathPlugin | ✓ atomic WYSIWYG | 中(仿写 ~50 行 diff + 组装) | **推荐** |
| B. atomic React wrapper + extensions | ✓ | ✗ 内置 imageBlocks 不可禁 | ✓ 可挂 mathPlugin | ✓ | 低 | 图片无法接入,否决 |
| C. @fedoup/markdown-editor 整体替换 | ✓ 语法隐藏 | ✓ imageResolver | ✗ **无公式** | ✗ **无表格 widget**(源码原样显示) | 低 | 不满足需求,仅参考 |
| D. codemirror-live-markdown 整体替换 atomic | ✓ | △ basePath 拼接,**无函数注入**,att:// 不适用 | ✓ | ✓ 可编辑表格 | 中(alpha) | 图片方案不成立 + alpha,否决 |
| E. atomic 底层组合 + 自研 math decoration | 同 A | 同 A | ✓ 仿写 ~150 行 | ✓ | 中高 | A 的 fallback |

### 逐一说明

**方案 C — @fedoup/markdown-editor**(0.1.0,单作者,79KB unpacked)
- 能力边界(源码 d.ts):`livePreviewPlugin({ imageResolver })` + `MarkdownEditor` + `defaultTheme` + `cursorEscapeFilter`(no-op)。**只有"语法隐藏"这一件事**:非激活行隐藏 markdown 语法标记,无 heading 大字号样式?——不,它按节点隐藏语法但**不渲染任何 widget**(无图片 widget 之外的东西;无表格 WYSIWYG、无公式、无任务复选框)。
- `imageResolver` 模式优秀(同步函数注入),是本调研采用的 API 模板(q2)。
- 结论:作为**完整编辑器不满足用户需求**(需求元素:表格/公式块)。仅参考其 resolver 设计。

**方案 D — codemirror-live-markdown 作为完整编辑器**
- 功能齐全(表格编辑器、代码高亮 lowlight、图片、链接、math),README 声称 modular。
- 三个否决点:
  1. **图片**:`imageField({ basePath })` + `resolveImagePath` 只做 basePath 字符串拼接(live-md dist:53399-53412),**无法为 att:// → 每图独立 blob URL 注入解析**;
  2. 版本 **0.5.1-alpha.1**(alpha);
  3. 其"源码显示"语义与一期体验差异大,替换成本高;而 atomic 的 React wrapper 我们本来就不用(方案 A 也只取 atomic 的扩展)。
- 但它贡献了可复用的 math 部分(方案 A 引用),这是它的正确用法。

**方案 A 论证**
- 需求元素全覆盖:标题/列表/引用/表格/代码块由 atomic 原生(inlinePreview + tables + codeLanguages 语法高亮);图片由仿写 imageBlocks(resolver)覆盖;公式由 live-md mathPlugin/blockMathField 覆盖。
- 增量依赖最小:仅新增 `@atomic-editor/editor` + `codemirror-live-markdown`(tree-shake 到 math 闭包)+ `katex` + `@codemirror/autocomplete`;CM6 其余 peer 一期已装(q1 核对表)。
- 官方架构支持底层组合(README Low-level composition),无 fork、无 hack。
- 备选 E(自研 math)作为 A 的降级路径,风险可控。

### 推荐组合(最终)

```
markdown 编辑器扩展栈(在 CodeBlock 的 markdown 分支内组装):
  [markdown({ base: markdownLanguage, codeLanguages, extensions: highlightMarkdown }),
   atomicMarkdownSyntax,
   atomicEditorTheme,
   tables({ onLinkClick }),
   仿写 imageBlocks({ resolve: attResolver }),   // att:// → blob URL(异步预取 + 同步查 Map)
   inlinePreview({ onLinkClick }),
   mathPlugin, blockMathField,                  // codemirror-live-markdown 按需 import
   window.katex 挂载,                            // import katex from 'katex'; window.katex = katex
   一期 keymap / updateListener / paste 拦截]
```

### 风险汇总(方案 A)

| 风险 | 等级 | 缓解 |
|---|---|---|
| live-md alpha 版 | 中 | 锁版本;math 源码已通读,随时可转方案 E 仿写 |
| atomic color-mix 在 Chrome 88 视觉降级 | 中 | 覆盖 --atomic-editor-* 变量 + 5 处裸用 fallback(见 q1) |
| math 与 atomic 边界场景(表格内公式) | 低 | 实现阶段 mock 验证;不满足则仿写时排除表格内 InlineCode |
| 上游裸 URL 显示 bug(PR #7 未合) | 低 | 跟踪;影响粘贴 URL 显示,可接受或本地 patch |
| atomic 无官方"禁用内置扩展"能力 | 已规避 | 走底层组合而非 wrapper |

## Caveats

- 各库体积/能力数据来自 npm 元数据与 dist 源码,未做打包实测;最终 bundle 增量以实现阶段构建产物为准。
- "数学方案 A 或 E"取决于团队对 alpha 依赖的接受度;两者源码路径均已打通,切换成本低。
