# Research: Q3 — 公式方案(mathPlugin / blockMathField / KaTeX)

- **Query**: codemirror-live-markdown 的 math 实现机制?与 atomic decoration 体系是否冲突?KaTeX 体积与 Chrome 88 兼容?
- **Scope**: external(源码 dist/index.js 已通读)
- **Date**: 2026-08-15

## Findings

### math 实现机制(源码实证,codemirror-live-markdown@0.5.1-alpha.1 dist/index.js)

**语法约定**:
- 行内公式:``` `$...$` ```(反引号包裹的 InlineCode 节点,源码注释:`Inline math: `$E=mc^2$``);
- 块级公式:``` `` ```math fence(CodeInfo == "math")。

**三个部件**(dist/index.js:52367-52473):
1. `mathPlugin`(ViewPlugin):`syntaxTree(state).iterate` 匹配 `InlineCode` 节点 → 内容为 `` `$...$` `` 时 → `Decoration.replace({ widget: new MathWidget(source, false) }).range(node.from, node.to)`。光标所在范围(shouldShowSource)或拖拽中(mouseSelectingField)时退化为 `cm-math-source` mark 显示源码。
2. `blockMathField`(StateField):匹配 `FencedCode` + `CodeInfo == 'math'` → `Decoration.replace({ widget, block: true }).range(node.from, node.to)` 覆盖整个 fence;源码显示时给每行加 `cm-math-source-block` line mark。update 策略:docChanged/reconfigured/拖拽结束/selection 变化时重建。
3. `MathWidget`(WidgetType):`toDOM()` → `renderMath(source, isBlock)` → **`window.katex.renderToString`**(从 window 全局读 KaTeX,不 import)→ `throwOnError: false, errorColor: '#cc0000', strict: false`,结果存 Map 缓存(`renderMath` 带 cache,key = `block|inline:source`)。

**不依赖 MatchDecorator**——纯 lezer syntaxTree 遍历 + 标准 Decoration.replace,与 atomic 的 inlinePreview/imageBlocks 完全同源(同用 syntaxTree.iterate + Decoration)。

### 与 atomic decoration 体系是否冲突(逐项)

| 方面 | 分析 | 结论 |
|---|---|---|
| decoration 来源 | math 用 ViewPlugin(行内)+ StateField(块级);atomic 用 ViewPlugin(inlinePreview)+ StateField(imageBlocks/tables)。CM6 允许多 decoration 源按 precedence 组合 | 共存无机制冲突 |
| 行内公式 `` `$...$` `` 与 atomic 的 InlineCode 处理 | atomic 对 InlineCode 只加 `cm-atomic-inline-code` **mark**(不 replace,HIDEABLE_SYNTAX 不含 InlineCode);mathPlugin 做 **replace**(同范围 replace 优先于 mark) | 无冲突,replace 优先显示公式 |
| 块级公式(```math)与 atomic 的 FencedCode 处理 | atomic 对 FencedCode 只做 line class + CodeMark/CodeInfo 语法隐藏(ViewPlugin 的 replace 被限制单行内,pushReplace 逐行拆分);blockMathField 做整块 replace(StateField 无跨行限制) | 无冲突,replace 优先 |
| ViewPlugin replace 跨行限制 | mathPlugin 的行内 replace 不跨行(InlineCode 单行),符合 CM6 "Decorations that replace line breaks may not be specified via plugins" 约束 | ✓ 合规 |
| 光标进公式块时的"显示源码" | atomic 的 fence 整块激活(activeLines 展开)与 blockMathField 的 shouldShowSource 各自独立判断 | 预期可共存,需实测 |
| 表格单元格内公式 | atomic tables 在 cell 内渲染 inline markdown;mathPlugin 的 InlineCode 匹配可能在 cell 内容上触发 | 未知,需实测(极端场景) |

**结论:机制上可共存**,官方架构文档也确认 CM6 的 decoration 组合是设计目标。实现阶段建议先做最小 mock(编辑器 + `$x$` + ```math 块 + 表格/引用混排)验证。

### 引入方式与体积

- 包:`codemirror-live-markdown` 0.5.1-alpha.1(MIT),exports 仅 `"."`(ESM dist/index.js 1.7MB 单文件)。
- **但导出符号分离**(文件末尾 `export { mathPlugin, blockMathField, ... }`),Rollup/Vite tree-shaking 对单模块内未导出符号可裁剪 → 只 import `mathPlugin` + `blockMathField` 时,其闭包(mathPlugin、blockMathField、MathWidget、renderMath、cache、shouldShowSource、mouseSelectingField、checkUpdateAction)约 **5-10KB gzip**,不会拖入 table/code/image 部分。
- 依赖:`window.katex` 全局 — 项目需 `import katex from 'katex'; window.katex = katex`(或在复制版 renderMath 里直接 import)。
- **alpha 标记风险**:0.5.1-alpha.1 是 alpha 版;锁定精确版本,不随 ^ 升级。

### 仿写参考(若不引入 live-markdown)

最小实现 = 官方源码裁剪(约 150 行),结构:
1. `MathWidget extends WidgetType`(toDOM → katex.renderToString,eq 比较 source/isBlock);
2. `mathPlugin`(ViewPlugin):syntaxTree.iterate 找 InlineCode `` `$...$` `` → replace;
3. `blockMathField`(StateField):找 FencedCode+math → block replace;
4. `shouldShowSource(state, from, to)`:光标在范围内则显示源码(可简化为与 atomic 相同的"激活行"逻辑,或直接用 atomic 的 activeLines 语义);
5. `window.katex` 或直接 import katex。
已具备完整参考源码(本调研已通读并记录行号)。

### KaTeX 评估(0.18.4)

| 项 | 数值/结论 |
|---|---|
| 版本 | 0.18.4(2026-07-17 发布;0.16.x 为更保守选择,项目普遍使用) |
| 体积 | katex.min.js 265.8KB + katex.min.css 24.1KB;gzip 后合计约 **85-95KB** |
| 语法 | UMD + **ES5 输出**(`!function(e,t){...}` 开头,var/function 风格;katex.mjs 同为 ES5 级语法)→ Chrome 88 无兼容风险 |
| CSS | 无 color-mix/oklch/:has/@layer 等现代特性 → Chrome 88 兼容 |
| 依赖 | 零运行时依赖;字体(woff2)随包发布,需 Vite 正确打包 `fonts/` 资源 |
| 版本建议 | 0.18.x 可用;若求稳可锁 0.16.x(功能无差,生态验证更久) |

### 建议(决策点)

1. **首选**:import live-markdown 的 `mathPlugin` + `blockMathField`(tree-shaking 后增量小);`window.katex` 挂载 katex 0.18.4。
2. 若 alpha 风险不接受 → 按上述 150 行仿写(源码在手,风险同样可控)。
3. KaTeX 按需加载:仅 markdown tab 首次挂载时动态 import(砍掉非 markdown 用户的加载成本)。

## Caveats

- 共存结论为源码机制分析,未实机运行验证(不修改产品代码)。
- live-markdown 的 shouldShowSource/mouseSelectingField 与 atomic 的 activeLines 语义可能微差(行内 vs 范围),导致光标在公式内时显示源码的触发边界略有不同——实现时以实际体验为准。
