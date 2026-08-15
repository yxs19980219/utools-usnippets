# Research: Q1 — @atomic-editor/editor 扩展机制与兼容性

- **Query**: atomic 是否支持挂自定义 CM6 扩展?React 19 兼容?体积?维护状态?老内核兼容?
- **Scope**: external(源码 + npm 数据)
- **Date**: 2026-08-15

## Findings

### extensions prop(问题核心:支持,但有约束)

`AtomicCodeMirrorEditorProps.extensions?: readonly Extension[]`(dist/AtomicCodeMirrorEditor.d.ts:159)。

- 消费者扩展**附加在内置扩展之后**(dist/AtomicCodeMirrorEditor.js:148-153 `// Consumer extensions last so they compose on top of the built-ins ... ...extensions`)。要压过内置 keymap 需 `Prec.high`。
- 官方 README 明示这是插件钩子:"Pass any number of CM6 extensions via the `extensions` prop to layer in autocomplete sources, **custom decorations**, domain-specific keymaps, collaboration (yjs), vim mode, or anything else"。wiki-links 扩展本身就是用这个钩子实现的。
- **关键约束**:extensions 在 mount 时一次性捕获(keyed on `documentId ?? markdownSource`),数组引用变化不会重新应用(d.ts:135-139)。动态数据(如 blob URL Map)必须经 ref 传稳定引用。

### 能否挂 codemirror-live-markdown 的 mathPlugin

可以——两者都是标准 CM6 扩展(mathPlugin 是 ViewPlugin、blockMathField 是 StateField),无专有机制冲突。具体兼容性分析见 q3。

### React 19 兼容

peerDependencies: `"react": "^18.0.0 || ^19.0.0"`, `"react-dom": "^18.0.0 || ^19.0.0"` — **通过**。内部用 `react/jsx-runtime` + hooks,无 React 19 特有问题。

### 版本与维护状态

- 当前 0.6.2(npm 2026-08);仓库 2026-04-22 创建,107 stars,6 open issues,MIT。
- 上游活跃:2026-05-31 仍有 bug 修复提交(freeze/stale-decoration crash);2026-04-25 发 v0.3.0(wiki-links)。
- 测试体系:Vitest + Playwright(~50 个回归探针)+ 真实产品(Atomic)作为 fuzz 语料。
- 已知 issue:1 个 open PR(#7,2026-06-18,草稿):**裸 URL(https://…)在非激活行 inline preview 中消失**的问题——粘贴 URL 失焦后看起来像没粘上。未合并,实现阶段需验证此场景。

### 体积

| 项 | 数值 |
|---|---|
| 包 unpacked | 402.6KB(tarball 101.3KB) |
| JS dist 合计(13 个模块) | ~209KB |
| CSS(inline-preview.css) | 29.9KB(独立文件,需手动 import `@atomic-editor/editor/styles.css`) |
| gzip 估算(JS,按 ~0.3 压缩比) | ~55-65KB(不含 CM6/react peer) |

依赖形态:CM6 全家 + react/react-dom 均为 **peerDependencies**(运行时依赖全部由宿主提供)。@codemirror/lang-* 系列全为 optional peer(代码语言注册表惰性加载)。

### 与一期依赖核对(是否需要新增包)

| atomic 需要 | 一期 package.json | 结论 |
|---|---|---|
| @codemirror/state / view / commands / language / search / lang-markdown | 全部已有 | ✓ |
| @codemirror/autocomplete(closeBrackets) | **没有** | 需新增 |
| @lezer/common / @lezer/highlight / @lezer/markdown | 未显式声明(作为 lang-markdown 传递依赖存在) | 建议显式安装,防 npm 解析出双实例(peer 单实例要求,README 有明确警告) |
| @codemirror/lang-javascript 等(optional peer) | javascript/css/html/json/sql/python 已有 | ✓(不装 cpp/go/java 等也不会报错,optional) |

### Chrome 88 兼容(静态检查)

- **JS**:dist 产物未发现 ES2022+ 语法(无 `Object.hasOwn`/`structuredClone`/`.at()`/`findLast`/`toSorted`/`toReversed`/static block 等)→ ES2021 及以下,Chrome 88(2021-01)全部支持。
- **CSS**:29.9KB 的 inline-preview.css 含 **17 处 `color-mix(in srgb, ...)`**(Chrome 111+ 才支持)。分两类:
  - 包裹在 `var(--atomic-editor-x, color-mix(...))` fallback 中(12 处,如 115/127/159/484 行):项目若定义同名 CSS 变量,fallback 永不生效 → 无影响;
  - **裸用 5 处**(171/234/264/401/542 行,如 `background: color-mix(in srgb, var(--atomic-editor-accent-bright, #a78bfa) 20%, transparent 80%)`):Lightning CSS 无法静态求值(含 var)→ 原样输出 → Chrome 88 解析失败忽略该声明(视觉降级,不崩溃)。
  - 对策:全量覆盖 `--atomic-editor-*` 变量(README 提供完整清单:--atomic-editor-accent/--accent-bright/--link/--code-bg/--selection-bg 等 ~30 个)+ 对 5 处裸用手写 `@supports not (color: color-mix(in srgb, red, red))` fallback,或接受降级(受影响:选中行/链接背景、focus 阴影等细节)。
- 未发现 uTools 特定 issue;无 iframe/sandbox 限制(一期 WebView 直接用)。

## Caveats

- 兼容性结论基于 dist 产物静态检查 + npm 元数据,未在 Chrome 88 实机验证。
- 仓库历史短(2026-04 创建),长期维护风险存在;但 0.6.x 已具备完整测试体系,风险可控。
- 上游无"禁用内置扩展"的 prop(如禁用 imageBlocks 的开关),这正是 q2 需要底层组合的原因。
