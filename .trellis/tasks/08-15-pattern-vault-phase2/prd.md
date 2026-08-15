# Pattern Vault 二期：markdown 笔记体验

## Goal

升级 markdown 笔记的编辑体验为 Obsidian 式即时渲染：atomic 编辑 + 图片就地渲染 + 公式 KaTeX 渲染，并显性区分笔记/片段。数据模型与一期完全一致（纯文本 + utools.db 附件存图），**零迁移**。

## Background

- 一期已交付并发布 v1.0.0：三栏布局、库(所有/收藏/回收站)/文件夹/标签、CM6 编辑、自动保存、图片粘贴落库、导入导出。
- 一期编辑器 `CodeBlock.tsx` 已预留二期替换边界（markdown 语言 → atomic）。
- 调研完成（`.trellis/tasks/08-15-pattern-vault-phase2/research/`）：atomic 支持扩展挂载、math 可与 atomic 共存、图片需仿写 imageBlocks、体积增量 ~160KB gzip、内核 Chromium 91-102 下 KaTeX/atomic 均可用。

## In Scope（二期）

- **atomic 编辑**：markdown 语言片段用 @atomic-editor/editor 底层组合替换 CM6；标题/列表/引用/代码块/表格原子支持；其余语言仍走 CM6。CodeBlock 对外接口不变。
- **图片就地渲染**：仿写 imageBlocks（官方实现作模板，加 `att:// → blob` resolver），图片仍存 utools.db 附件（postAttachment，方案不变），编辑态直接显示。
- **公式**：`mathPlugin`（行内 `$...$`）+ `blockMathField`（```math 块）复用 codemirror-live-markdown（锁 0.5.1-alpha.1），KaTeX 渲染。
- **笔记/片段区分**：中栏头部 `＋` 弹出二选一菜单（片段/笔记，带图标）；列表项恢复类型图标区分（笔记 BookOpen / 片段 FileCode）。笔记 = 单 markdown 片段。
- **markdown 格式快捷键**（仅笔记编辑器）：Ctrl+B/I 粗斜体、Ctrl+K 链接、Ctrl+1-6 标题、Ctrl+Shift+C 代码块等。
- **列表 hover 复制**。

## Out of Scope（三期及以后）

- 呼出即搜（uTools 独立搜索命令）。
- 编辑历史/版本、分享、多笔记模板等。

## Key Decisions

- 编辑器：**atomic 底层组合**（非 React wrapper，因 wrapper 无法注入图片 resolver）+ live-md math（按需 import，tree-shake）。
- 图片：仿写 imageBlocks 加 resolver；`att://` 由一期 `lib/attachment.ts` 的 imageToBlobUrl + 预取 Map 解析为 blob URL。
- 公式：KaTeX 0.18.4（ES5 UMD，通过 `window.katex` 全局访问）；行内与块级都做。
- 依赖锁版本：`codemirror-live-markdown@0.5.1-alpha.1`；显式安装 lezer 三件套防 peer 双实例。
- 兼容：vite `build.target: 'chrome88'`；atomic CSS 的 color-mix 用 Lightning CSS + 变量覆盖处理。
- 交互：新建二选一菜单（不打断直接建流程）；图标区分列表项类型。

## Acceptance Criteria

- [ ] markdown 笔记打开即 Obsidian 式即时渲染编辑：标题/列表/引用/代码块/表格就地渲染，光标行显示源码。
- [ ] 粘贴图片就地显示（非源码引用）；存量 `att://` 引用的图片正常渲染；图片仍存 utools.db 附件。
- [ ] 行内公式 `$...$` 与公式块 ```math 实时 KaTeX 渲染。
- [ ] 新建：`＋` 弹出 片段/笔记 二选一；笔记 = 单 markdown 片段；列表用两种图标区分。
- [ ] markdown 格式快捷键生效（Ctrl+B/I/K/1-6/Shift+C 等），不影响其他语言编辑。
- [ ] 列表项 hover 出现复制按钮，点击复制全文。
- [ ] 其他语言片段编辑器、自动保存、图片粘贴落库、搜索/视图/回收站行为与一期一致（回归）。
- [ ] 构建通过（tsc + vite，target chrome88）；uTools 实机混排（公式+表格+图片）渲染正常；无 oklch 线框回归。

## Technical Notes

- 编辑器边界：`CodeBlock.tsx` 内 `language === 'markdown'` 分支拆独立 `MarkdownEditor` 组件，对外 props（value/onChange/language/onPasteImage）不变。
- 记录切换：atomic 用 documentId 语义替代一期 value-sync；粘贴图片拦截复用一期逻辑。
- bundle 增量预期 ~160KB gzip（atomic 60 + KaTeX 90 + math 5 + autocomplete 5），总包 ~500KB gzip。

## Risks / Deferred

- live-md math 为 alpha 版本：锁版本 + 实现已分析可与 atomic 共存；不兼容则仿写（StateField + WidgetType + KaTeX，参考 Obsidian LaTeX-Formula-Support 实现）。
- atomic 上游 PR #7（裸 URL）影响图片，跟踪或转仿写兜底。
- atomic CSS color-mix（17 处）：Lightning CSS 静态求值覆盖变量部分，其余 @supports fallback 或接受视觉降级。
- 混排（公式+表格+图片）需 uTools 实机验证，源码机制分析不能替代实机。
