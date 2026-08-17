# Implement：UI 增强执行计划

## 顺序与步骤

1. **types.ts**：`Category` 接口加 `defaultLanguage?: string`
2. **stores/records.ts**：
   - `createRecord(kind, options?: { categoryId?: string|null, language?: string })`：categoryId 默认 null、language 默认全局默认
   - 新增 `moveCategoryToTrash(categoryId)`：该分类下未删除记录置 `deleted=true` 并逐一落库
   - 新增 `removeTagFromAll(tag)`：遍历 records 过滤 tags，受影响记录落库
3. **stores/categories.ts**：
   - `create` 时兼容传入语言（可不传）
   - 新增 `setDefaultLanguage(id, language)`：更新内存 + saveCategory
   - `remove`：先 `useRecords.moveCategoryToTrash(id)`，再 `deleteCategory`
4. **components/Sidebar.tsx**：
   - `NavRow` 加 `...rest` 透传
   - 文件夹右键菜单：重命名（保留）+ "默认片段语言"子菜单 + 删除（文案改移入回收站 + 记录数）
   - 标签行包 ContextMenu：删除标签（确认框）
5. **components/ListPane.tsx**：
   - `FileCode2Icon` → `Code2Icon`（列表项 + 新建菜单）
   - `handleNew`：若当前 view 为 category，传 categoryId + 语言（分类默认语言 ?? 全局默认）
6. **components/SearchView.tsx**：
   - `ShortcutBadge` 纯文字样式
   - 标题行：收件箱（categoryId=null）显示黄色 FolderIcon + "收件箱"
7. **验证**：`npm run build`（tsc -b + vite build）+ 手动检查关键交互

## 验证命令

```bash
npm run build
```

## Review Gates

- 文件夹右键能弹出（修复透传是核心，需用户在 uTools 内实测）
- 文件夹删除后其记录出现在回收站视图
- 标签删除后各记录 tags 中消失
- 文件夹视图下新建片段归入该文件夹且语言正确

## Rollback

- 所有改动集中在 6 个源文件，git 单次提交即可整体回退