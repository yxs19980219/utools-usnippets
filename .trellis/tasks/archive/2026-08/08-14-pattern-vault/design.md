# uTools 模式库插件 — 技术设计

## 0. 设计体系（用户确认）

- 组件库：shadcn/ui（Tailwind v4 语法）。设计 Token：`design-tokens.css`（同目录，用户提供，浅色 `:root` + 深色 `.dark`）。
- 字体：Inter（sans）/ JetBrains Mono（mono，代码编辑器用）/ Georgia（serif）。
- 圆角：--radius 0.75rem；阴影：浅色 4px/12px/8% 透明度系，深色 6px/20px/40% 系。
- 兼容：全部 Token 含 oklch() → 必须 Lightning CSS 降级（chrome 88）转 hex/rgba；`.dark` 类与 shadcn darkMode class 策略一致（uTools isDarkColors 驱动）。

## 1. 架构与边界

```
┌──────────────────────── uTools WebView ────────────────────────┐
│ React 19 + Vite + TS + Tailwind4 + shadcn/ui + Zustand         │
│                                                                │
│  UI 层(components/)                   状态层(stores/)           │
│  TopBar / Sidebar / ListPane /         records / categories    │
│  EditorPane / StatusBar / Dialogs      ui / settings            │
│         │                                     │                │
│         └──────────────┐  ┌──────────────────┘                │
│                    lib/ 数据服务层(唯一数据入口)                 │
│  db(utools 适配器)  search  markdown  attachment  icons  copy   │
│         │                                                        │
│  window.services ─────────────────────────────┐                 │
└───────────────────────────────────────────────┼─────────────────┘
                                                │
┌───────────────── preload/services.js (CommonJS, 源码可读) ──────┐
│  db CRUD(记录/分类)  附件 put/get  图片落盘  文件对话框(导入导出) │
│  最小权限:只暴露这四组能力,不暴露 fs                                │
└─────────────────────────────────────────────────────────────────┘
```

边界约定：
- 渲染进程一律经 `lib/db.ts` 访问数据，不直接调 window.services 散落调用。
- preload 只做数据/文件能力，不涉及 UI 逻辑。
- 编辑器组件（CodeBlock）封装 CM6，二期替换 atomic 只动该组件及 markdown 渲染层。

## 2. 数据模型（utools.db 文档）

```
记录   { _id: "pattern/<uuid>", _rev,
         title: string,
         scenario: string,              // 场景/备注, 列表摘要取首行
         fragments: [                   // 多片段, 一期至少 1 个
           { id: "<uuid>", language: "sql", content: string }
         ],
         categoryId: string | null,     // null = 未分类
         tags: string[],
         createdAt: number, updatedAt: number,
         version: 1 }
分类   { _id: "category/<uuid>", _rev, name: string, order: number,
         createdAt, updatedAt, version: 1 }
附件   postAttachment("pattern/<patternId>/img-<ts>", buffer, mime)
      正文引用: ![](att://pattern/<id>/img-<ts>)
```

- 类型推断（列表图标）：记录 fragments 全部为 markdown ⇒ 笔记图标，否则片段图标。不冗余存 type。
- 标签聚合：侧边栏标签云 = 全库扫描去重计数（MVP 数据量小，无需索引文档）。
- 附件 id 规则随正文引用，重命名记录不影响附件。

## 3. 数据流

```
新建   → 生成记录(默认 js fragment) → 落库 → 选中并进入编辑态
编辑   → fragment 内容变化 → 防抖 1s → 更新记录文档(updatedAt)
图片   → paste 事件拦截 → window.services.putAttachment → 成功
         后插入 ![](att://<id>) 文本(保证先附件后正文)
搜索   → 顶部输入 → lib/search 过滤当前列表源(分类/标签/全部)
         → 匹配: 标题/场景/标签/正文全文(小写 includes)
导入   → 文件对话框读 JSON → 校验 → 批量写库(附件 base64 还原)
导出   → 全库读 → 记录+分类+附件(base64) → 写 JSON 文件
```

## 4. 模块划分

| 模块 | 职责 |
|---|---|
| `preload/services.js` | db 增删改查、附件 put/get、图片保存、导入导出文件对话框 |
| `lib/db.ts` | window.services 的 TS 封装 + 记录/分类 CRUD + 附件引用解析 |
| `lib/search.ts` | 纯函数过滤（标题/场景/标签/正文） |
| `lib/icons.ts` | 记录 → 类型图标/语言徽标推断 |
| `lib/clipboard.ts` | 复制（文本 / 代码块） |
| `lib/attachment.ts` | `att://` 引用 → blob URL（二期渲染用，一期预留） |
| `components/editor/CodeBlock.tsx` | CM6 封装（语言包、主题、行号、粘贴图片拦截） |
| `components/editor/FragmentTabs.tsx` | 多片段 tab 行（增删/切换/拖拽排序） |
| `components/editor/StatusBar.tsx` | 语言选择器（作用于当前 tab）+ 行数 + 保存状态 |
| `stores/*` | zustand：records、categories、ui（选中/折叠/过滤）、settings |

## 5. 关键技术点

### 5.1 CM6 集成
- `@codemirror/lang-*` 语言包按需注册（js/ts/sql/json/html/css/python/markdown/plaintext 等）。
- markdown 语言：`@codemirror/lang-markdown`（语法高亮），一期无即时渲染。
- 粘贴图片：监听 CM6 DOM 的 paste 事件，`clipboardData.items` 含 image → 附件 → 插入 markdown 语法（仅 markdown 语言 tab 启用）。
- 主题随深色模式切换（CM6 dark theme / 自定义高亮样式）。

### 5.2 附件与图片
- `window.services.putAttachment(id, buffer, mime)`：Uint8Array ↔ ArrayBuffer 转换；失败回滚（不插入文本）。
- >10M 拦截 toast 提示。
- 替换图片：删旧附件（`removeAttachment`）+ 建新，更新正文引用。

### 5.3 自动保存
- CodeBlock onChange → store 更新 → 防抖 1s flush 到 db（`updateRecord`）。
- 保存状态：`idle | saving | saved | error`，状态栏展示；组件卸载前 flush。
- 冲突处理：MVP 单窗口无并发，直接覆盖（带 version 字段满足 uTools 更新要求）。

### 5.4 搜索与列表
- 过滤在内存执行（数据量 < 数千条），输入防抖 150ms。
- 列表排序：updatedAt 降序；"未分类"为分类树固定首项。
- 列表项 hover 复制（一期详情页复制为主，hover 复制留二期，右键菜单含复制）。

### 5.5 分类/标签
- 分类树：自建（树底 + 新建）、改名/删除（右键）、记录拖拽移动（HTML5 DnD 或简易实现）。
- 删除分类 → 其下记录回"未分类"（不级联删除）。
- 标签：记录内增删；标签云点击筛选（与分类/搜索条件组合，AND 语义）。

### 5.6 uTools 内核兼容
- vite: `css.transformer: 'lightningcss'`, `lightningcss.targets: { chrome: 88 }`, `build.cssMinify: false`。
- `base: './'`；`stripDevelopmentField` 插件清发布版 development 字段。
- preload 同级 `package.json` `{"type":"commonjs"}`；路径用 `path.join()`。
- 深色：CSS `prefers-color-scheme` + `utools.isDarkColors()`（JS 侧）。

### 5.7 导入导出
- JSON 结构：`{ version, categories, patterns, attachments: [{id, mime, data(base64)}] }`。
- 导出：设置按钮 → 文件对话框（saveFile）写文件。
- 导入：文件对话框（openFile）→ 校验 version/字段 → 批量写库；附件 base64 → buffer → postAttachment。
- 导入前备份现有库（导出到 userData 临时文件）。

## 6. 二期预留（设计不阻塞）

- 编辑器：`CodeBlock` 组件接口保持（value/onChange/language/paste-image），二期 markdown 语言替换为 atomic，仅动组件内部。
- 渲染层：`lib/attachment.ts` 的 `att:// → blob` 解析一期就绪；二期详情渲染层（markdown-it + KaTeX + highlight）直接复用。
- 呼出即搜：plugin.json 二期加独立 feature 命令；中栏列表行组件已可复用。

## 7. 风险与回滚

- 风险：老内核 CSS 兼容（以 Lightning CSS 降级 + 实测为准）；CM6 在 uTools WebView 性能（MVP 数据量小，风险低）；附件 API 行为差异（以文档实测为准）。
- 回滚：数据纯文本可随时导出；编辑器替换二期才发生；一期无迁移需求。
