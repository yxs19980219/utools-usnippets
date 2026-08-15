# Pattern Vault 二期 — 实施计划

## 前置条件

- [ ] 用户批准最终规划摘要。
- [ ] 调研报告已就绪（research/ 6 份，实现时按需重读对应 q 文件）。
- [ ] 任务激活：`task.py start`。

## 实施清单（顺序执行）

### Phase 0：依赖与基建
- [ ] 0.1 安装：`@atomic-editor/editor`、`codemirror-live-markdown@0.5.1-alpha.1`（锁）、`katex`、`@codemirror/autocomplete`、lezer 三件套（`@lezer/common`、`@lezer/highlight`、`@lezer/lr`，防 peer 双实例）
- [ ] 0.2 vite `build.target: 'chrome88'` 显式设置
- [ ] 0.3 KaTeX 全局注入方案确认并落地（window.katex 或等价接入，以 research/q3 为准）
- [ ] 0.4 **最小 mock 验证**：MarkdownEditor 雏形 = atomic 底层组合 + `$x$` + ```math 块 + 表格混排，dev 下实机验证共存后再继续（风险关口）

### Phase 1：MarkdownEditor 组件
- [ ] 1.1 仿写 imageBlocks（官方实现作模板）+ `att:// → blob` resolver（lib/attachment 预取 Map）
- [ ] 1.2 atomic 底层组合装配：inlinePreview + tables + imageBlocks(仿写) + math 扩展 + 主题 + keymap
- [ ] 1.3 对外接口对齐 CodeBlock（value/onChange/language/onPasteImage/dark），记录切换用 documentId 语义
- [ ] 1.4 EditorPane 按语言路由：markdown → MarkdownEditor，其余 → CodeBlock（CodeBlock 不动）

### Phase 2：笔记/片段区分
- [ ] 2.1 records store：createRecord 参数化类型（snippet/note），新增 createNote
- [ ] 2.2 ListPane `＋` → Popover 二选一菜单（片段/笔记，带图标）
- [ ] 2.3 ListItem 恢复类型图标（BookOpen/FileCode）

### Phase 3：配套
- [ ] 3.1 markdown 格式快捷键 keymap（Ctrl+B/I/K/1-6/Shift+C）
- [ ] 3.2 列表项 hover 复制按钮
- [ ] 3.3 回归：非 markdown 编辑、自动保存、粘贴图片、搜索/视图/回收站、导入导出逐项手测

## 验证命令

- `npm run build`（tsc + vite，target chrome88）— 通过且 dist 无 development
- uTools 实机：markdown 混排（公式+表格+图片）、新建二选一、图标、快捷键、hover 复制
- 一期功能回归清单（PRD AC-7）

## 关键验收点（对应 PRD AC）

1. 即时渲染编辑全元素（AC-1）——Phase 1 后
2. 图片就地渲染 + 存量 att:// 正常（AC-2）——Phase 1 后
3. 公式行内/块级（AC-3）——Phase 0.4 mock 先行
4. 新建二选一 + 图标（AC-4）——Phase 2 后
5. 快捷键 + hover 复制（AC-5/6）——Phase 3 后
6. 回归 + 构建 + 实机（AC-7/8）——Phase 3 后

## 风险文件 / 回滚点

- `MarkdownEditor.tsx`（二期核心）：混排 mock 不过 → 回退方案 = live-md 全量 / 仿写 math；组件内原子替换，不触及其他模块
- `vite.config.ts`（target 改动）：一期降级配置保留，仅加 target
- `records.ts`（createNote）：向后兼容，一期数据零影响
- 每个 Phase 完成跑一次 `npm run build`

## 完成后

- trellis-check 全量检查；spec 回写（atomic/公式/图片经验）；commit + tag v1.1.0（如用户要求）。
