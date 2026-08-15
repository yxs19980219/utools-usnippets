# Research: Pattern Vault 二期 markdown 体验 — 调研总览

- **Query**: atomic(@atomic-editor/editor)即时渲染替换 markdown 编辑器;图片 att:// 就地渲染;公式 KaTeX 渲染的技术可行性
- **Scope**: mixed(外部库源码 + 本仓库一期代码)
- **Date**: 2026-08-15

## 调研结论速览(对应 6 个调研问题)

| # | 问题 | 结论 | 详见 |
|---|---|---|---|
| 1 | atomic 扩展机制 | `extensions` prop 存在且官方支持挂第三方 CM6 扩展;React 19 兼容;版本 0.6.2 活跃维护;JS 无 ES2022+ 语法,Chrome 88 兼容;CSS 有 17 处 color-mix 需降级处理 | q1-atomic-extensions.md |
| 2 | 图片接入点 | atomic 内置 `imageBlocks()` 无参数、硬编码进 React wrapper,**无 URL 解析钩子,无法禁用**;需走"底层组合"路线仿写 imageBlocks(官方实现仅 ~230 行,改成 resolver 模式即可);fedoup 的 imageResolver(同步函数注入)是可参考的 API 模式 | q2-image-blocks.md |
| 3 | 公式方案 | codemirror-live-markdown 的 mathPlugin/blockMathField 基于 lezer syntaxTree + 标准 decoration(非 MatchDecorator),与 atomic 的 decoration 体系同源,**机制上可共存**(inline 无 replace 冲突、block 走 StateField 满足 CM6 约束);KaTeX 0.18.4 为 ES5 UMD 输出,Chrome 88 兼容 | q3-math-katex.md |
| 4 | 备选方案 | **推荐:atomic 底层组合 + codemirror-live-markdown mathPlugin(按需 import)+ 仿写 imageBlocks(resolver)**;@fedoup/markdown-editor 无表格/公式,不满足需求,仅作参考;live-markdown 全量替换 alpha 版、图片无函数注入,不推荐 | q4-alternatives.md |
| 5 | 集成路径 | CodeBlock 组件内 `language === 'markdown'` 分支走 atomic,其余语言保持现有 CM6;对外接口 value/onChange/language/onPasteImage 不变;增量 ~155-165KB gzip(atomic + katex + math) | q5-integration-and-compat.md |
| 6 | 体积与老内核 | 主要风险:atomic CSS color-mix(Chrome 111+)需变量覆盖 + 少量 @supports fallback;KaTeX/atomic JS 均无兼容风险;blob URL 可用 | q5-integration-and-compat.md |

## 推荐组合

```
markdown 语言编辑器 = 底层组合(不经 React wrapper):
  markdown({ base: markdownLanguage, codeLanguages, extensions: highlightMarkdown })
  + atomicMarkdownSyntax + atomicEditorTheme
  + tables({ onLinkClick })
  + 自定义 imageBlocks({ resolve })   ← 仿写官方实现,att:// → blob URL
  + inlinePreview({ onLinkClick })
  + mathPlugin + blockMathField       ← import { mathPlugin, blockMathField } from 'codemirror-live-markdown'
  + katex (window.katex 挂载)
  + 一期已有 keymap / updateListener / 粘贴图片拦截
```

**理由**:
1. React wrapper 硬编码 `imageBlocks()`(无参、不可禁用、不可注入 resolver),att:// 会直接塞进 `img.src` 加载失败;必须绕开 wrapper 才能注入自定义图片解析。
2. 底层组合是官方 README 明文支持的路子("Low-level composition",所有模块均从主入口导出,sideEffects 只声明 css,可被 Vite tree-shake 掉未用部分)。
3. math 直接用 live-markdown 的现成实现(导出符号分离,按需 import 只带 math 闭包),不满足再仿写(源码已定位,~150 行)。
4. 一期 CM6 peer 依赖几乎全齐,仅需新增 `@codemirror/autocomplete`(atomic 内部用 closeBrackets)与显式 lezer 三件套防双实例。

## 风险清单(实现前必须处理)

| 风险 | 等级 | 说明与对策 |
|---|---|---|
| atomic CSS color-mix(17 处,5 处裸用)在 Chrome 88 失效 | 中 | Lightning CSS 只静态求值"无 var"的 color-mix;含 var 的原样保留 → Chrome 88 忽略该声明(视觉降级,不崩溃)。对策:全量覆盖 `--atomic-editor-*` 变量(README 有清单)+ 对 5 处裸用手写 fallback 或接受降级 |
| `extensions` 在 mount 时一次性捕获 | 低 | 改引用不重应用;blob Map 等动态数据经 ref/稳定引用传入,不要依赖 prop 变更重挂载 |
| 裸 URL 在非激活行可能消失(上游 PR #7 未合,2026-06) | 低 | 上游已知 bug,影响粘贴 URL 的显示;跟踪 PR 或接受(可编辑行恢复),实现阶段用 demo 验证 |
| mathPlugin 与 atomic 的 decoration 冲突 | 低 | 机制同源可共存,但须实测:inline math(`` `$...$` ``)atomic 只加 mark 不 replace;block math 用 StateField 无跨行限制。建议 mock 测试 `$x$`/```math 块与表格/引用组合 |
| KaTeX 通过 `window.katex` 全局访问 | 低 | live-markdown 的 renderMath 读 `window.katex`,需 `import katex from 'katex'; window.katex = katex`;或复制 renderMath 改为直接 import |
| live-markdown 为 0.5.1-alpha.1 | 中 | 版本标记 alpha;若选它,锁定版本(不 ^ 升级);备选是自研 math decoration(源码已备) |
| peer 依赖双实例 | 低 | atomic 的 peer 要求 CM6 单实例;安装时显式对齐 peer 版本(见 q1 的依赖核对表) |

## 参考资料

- atomic-editor 仓库: https://github.com/kenforthewin/atomic-editor (MIT, 107 stars, 活跃)
- atomic-editor 架构文档: https://github.com/kenforthewin/atomic-editor/blob/main/docs/architecture.md
- atomic-editor npm: https://www.npmjs.com/package/@atomic-editor/editor (0.6.2)
- codemirror-live-markdown: https://github.com/blueberrycongee/codemirror-live-markdown (0.5.1-alpha.1, MIT)
- @fedoup/markdown-editor: https://www.npmjs.com/package/@fedoup/markdown-editor (0.1.0, MIT)
- KaTeX: https://katex.org/docs/browser (0.18.4, ES5 UMD, Chrome 88 兼容)
- Lightning CSS color-mix 降级: https://lightningcss.dev/transpilation.html#color-mix (静态求值仅限无 var)
- color-mix 兼容: https://caniuse.com/wf-color-mix (Chrome 111+)

## 分项报告

- q1-atomic-extensions.md — atomic 扩展机制、版本、体积、兼容性
- q2-image-blocks.md — 图片就地渲染接入点与实现模式
- q3-math-katex.md — 公式方案机制分析与 KaTeX 评估
- q4-alternatives.md — 备选方案对比与推荐组合论证
- q5-integration-and-compat.md — 集成路径 + 体积与老内核风险

## Caveats / Not Found

- 未发现 atomic 的 uTools/Chrome 88 老内核专项 issue(仓库历史短,2026-04 创建);兼容性结论基于 dist 产物静态检查(无 ES2022+ 语法、CSS color-mix 需降级)
- mathPlugin 与 atomic 的共存结论基于源码机制分析,**未做真实运行验证**(调研不修改产品代码)
- 未评估 atomic 表格 widget(tables)与 math 在同表内共存的极端场景(表格单元格内公式):官方 tables 在 cell 内渲染 inline markdown,mathPlugin 的 InlineCode 匹配可能进入表格单元格,建议实现阶段验证
- 附件 blob URL 生命周期(revoke 时机)一期 attachment.ts 已留注释,二期实现需自行决策(编辑会话内持有、销毁时统一 revoke)
