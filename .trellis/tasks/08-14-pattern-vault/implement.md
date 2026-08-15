# uTools 模式库插件 — 实施计划

## 前置条件

- [ ] `utools-dev` skill 的 references/utools-api.md 为 uTools API 唯一依据。
- [ ] 技术栈已确认（React 19 + Vite + TS + shadcn/ui + Tailwind + Zustand），按 PRD Key Decisions。
- [ ] 任务激活：`python ./.trellis/scripts/task.py start`（用户批准最终规划摘要后）。

## 实施清单（顺序执行）

### Phase A：工程骨架
- [ ] A1 按 utools-dev skill 模板初始化项目：public/（plugin.json + logo + preload/）、src/、vite.config（base './' + stripDevelopmentField + Lightning CSS 降级 chrome 88 + cssMinify false）
- [ ] A2 preload/services.js：db CRUD、附件 put/get/remove、文件对话框（导入导出）；CommonJS、源码可读、最小权限
- [ ] A3 依赖安装：react19、zustand、@codemirror/*（view/state/commands/language/lang-markdown/lang-javascript/lang-sql 等）、tailwind4、shadcn 组件、highlight.js（二期渲染预留可不装）
- [ ] A4 验证：`npm run build` 产出 dist 干净（无 development 字段）；uTools 开发者工具能加载

### Phase B：数据层
- [ ] B1 lib/db.ts：记录/分类 CRUD（含 version 字段）、附件封装、att:// 解析预留
- [ ] B2 stores：records / categories / ui / settings（zustand）
- [ ] B3 导入导出 JSON 实现（lib/import-export.ts + preload 文件对话框打通）

### Phase C：编辑器
- [ ] C1 CodeBlock：CM6 封装（语言包注册、行号、自动换行、深色主题切换）
- [ ] C2 markdown 语言 tab 的粘贴图片拦截 → 附件 → 插入 `![](att://<id>)`
- [ ] C3 FragmentTabs：多片段 tab 行（添加/切换/删除/拖拽排序）
- [ ] C4 StatusBar：语言选择器（切当前 tab）+ 行数 + 保存状态
- [ ] C5 自动保存：onChange 防抖 1s 落库，卸载前 flush

### Phase D：主窗口 UI
- [ ] D1 布局：TopBar（搜索/新建/设置）+ 三栏 + 左栏折叠 + 初始高度 700
- [ ] D2 Sidebar：分类树（自建/改名/删除/拖拽移动记录）+ 未分类固定区 + 标签云筛选
- [ ] D3 ListPane：列表项（类型图标 + 标题 + 场景摘要 + 语言徽标）+ 最近修改排序 + 右键菜单（移动分类/删除/导出图片）+ 空状态
- [ ] D4 EditorPane：标题/场景输入 + FragmentTabs + CodeBlock 组装 + 复制按钮
- [ ] D5 新建流：直接建记录进编辑态；删除分类回未分类
- [ ] D6 搜索：顶部输入 → lib/search 过滤（标题/场景/标签/正文，防抖 150ms）
- [ ] D7 深色模式：prefers-color-scheme + isDarkColors
- [ ] D8 设置面板：深色跟随、默认语言、导入导出按钮

## 验证命令

- `npm run build` — 构建通过，dist/plugin.json 无 development
- `npm run dev` + uTools 开发者工具加载 public/ — HMR 联调
- uTools 内手工验收（对照 PRD Acceptance Criteria 逐条）

## 关键验收点（对应 PRD AC）

1. 新建→编辑→防抖保存→重启不丢（AC-1/3）
2. 多片段 tab 全操作 + 语言切换（AC-2）
3. markdown tab 粘贴图片 → 附件 + 源码引用（AC-4）
4. 搜索过滤 + 分类/标签联动（AC-5/7）
5. 复制/右键/深色/导入导出（AC-8/9）
6. 老内核无线框（AC-10）

## 风险文件 / 回滚点

- vite.config.js（降级配置错误 → 界面线框）：回滚 = 按 skill 模板重配
- preload/services.js（API 签名错 → 数据层故障）：以 utools-api.md 为准
- CodeBlock.tsx（CM6 集成点）：二期 atomic 替换边界
- 每完成一个 Phase 跑一次 `npm run build` 确认无回归

## 完成后

- 按 trellis-check 做全量质量检查；更新 spec（utools-dev 相关经验回写 .trellis/spec）。
