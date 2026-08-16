# 实施清单：UI 优化第一轮

> 轻量任务，全部为 UI 局部调整，无架构变更。按序执行，每项完成后验证。

## 顺序与检查点

1. **App.tsx**：删除 `ut.setExpendHeight?.(700)` 及所在注释（需求 1）
   - 检查：grep 无 `setExpendHeight`
   - 备注：需求 2（灰区）经实测确认是 uTools 基座 bug（webview bounds 不同步），插件内不修复，见 prd.md
2. **ListPane.tsx**（需求 3/6）
   - `BookOpenIcon` → `FileTextIcon`（列表项 + 新建菜单）
   - 删除列表项右上角 hover 复制按钮（`CopyIcon` 块）
   - 删除语言徽标 badge span（`meta.badge`）；`listMeta` 若仅剩 `isNote` 用途，就地简化（不改 `lib/icons.ts` 导出签名，避免影响他处）
   - 检查：列表项结构 = 图标 + 标题 + 场景行；无 CopyIcon、无 badge
3. **EditorPane.tsx**（需求 4/5/6）
   - 标题 input：`text-base` → `text-lg`；placeholder 类名去掉 `font-semibold`，颜色改浅（`text-muted-foreground/50` 或等价浅灰）
   - 删除内容区 `group relative` 内的悬浮复制 Button 块（含 `group-hover` 类）
   - 保留标题栏复制按钮与 `handleCopyCurrent`
   - 检查：标题栏 5 个按钮（≡ / 标题 / T / ＋ / 复制）齐全；编辑区内无 CopyIcon
4. **Sidebar.tsx**（需求 7）
   - 重构为四区域：
     - 库：`shrink-0`（不滚动）
     - 文件夹：`min-h-0 flex-1 overflow-y-auto`
     - 标签：`shrink-0` + `max-h` 限制 + `overflow-y-auto`
     - 设置：`flex h-8 shrink-0 items-center justify-center`（去 `border-t`）
   - 新建分类 inline 输入、右键菜单、删除确认对话框保留不动
   - 检查：四个区域边界清晰；文件夹溢出滚动；标签溢出滚动；设置居中无横线
5. **验证**：`npm run build`（或 `tsc`/lint 若 package.json 提供）；`git diff` 复核只含上述改动

## 验证命令

- `npm run build`（构建 + 类型检查，项目无独立 lint 脚本时以 build 为准）
- 用户侧：uTools 重新加载插件，逐条对照 PRD 验收
