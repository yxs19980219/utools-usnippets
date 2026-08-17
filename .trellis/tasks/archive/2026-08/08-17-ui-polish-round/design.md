# Design：UI 增强实现方案

## 涉及文件

| 文件 | 改动 |
|------|------|
| `src/types.ts` | `Category` 加 `defaultLanguage?: string` |
| `src/stores/categories.ts` | `create` 支持默认语言字段；新增 `setDefaultLanguage(id, lang)`；`remove` 改为移入回收站 |
| `src/stores/records.ts` | 新增 `moveCategoryToTrash(id)`（其下记录软删除）；新增 `removeTagFromAll(tag)`；`createRecord` 支持传入 `categoryId`/`language` 覆盖 |
| `src/components/Sidebar.tsx` | `NavRow` 透传 `...rest`；文件夹右键加"默认片段语言"子菜单；删除确认文案改移入回收站；标签加右键删除菜单 |
| `src/components/ListPane.tsx` | 图标 FileCode2Icon→Code2Icon；新建时根据当前视图传分类与语言 |
| `src/components/SearchView.tsx` | ShortcutBadge 样式改纯文字；收件箱黄色图标+文字 |

## 数据流

### 文件夹默认语言
```
Category.defaultLanguage (db 同步)
  ↓ Sidebar 右键子菜单选择 → categories.setDefaultLanguage(id, lang)
ListPane 新建片段时：
  view.type==='category' && view.id !== null
    → categoryId = view.id, language = category.defaultLanguage ?? settings.defaultLanguage
  否则 → categoryId = null, language = settings.defaultLanguage（现状）
```

### 删除文件夹 → 移入回收站
```
Sidebar 删除确认 → categories.remove(id)
  → records.moveCategoryToTrash(id)  // 该分类下所有未删记录 deleted=true，逐一落库
  → deleteCategory(id)
若当前视图是该分类 → setView({type:'all'})（现状保留）
```

### 标签删除
```
Sidebar 标签右键删除 → 确认 → records.removeTagFromAll(tag)
  → 遍历 records，tags 中移除该标签，受影响记录逐一落库
若当前视图是 tag 且等于该标签 → setView({type:'all'})
```

## 细节决策

1. **NavRow 透传**：`NavRow` 解构时加 `...rest` 并展开到 div，确保 Radix 注入的 `onContextMenu`/`data-state` 生效。文件夹行和标签行都用 ContextMenu 包裹。

2. **默认语言子菜单**：用 `ContextMenuSub` + `ContextMenuSubContent`，内层列出 `LANGUAGES`，当前语言打勾（CheckIcon）。当前无默认（继承全局）时勾选"跟随全局"。

3. **createRecord 签名扩展**：`createRecord(kind, options?: { categoryId?: string|null, language?: string })`，默认保持现有行为（categoryId=null, 全局语言）。ListPane 的 `handleNew` 传入当前视图上下文。

4. **回收站语义**：`moveCategoryToTrash` 只影响**未删除**的记录（已删除记录不动），且将其 `categoryId` 清空——原分类已删除，保留 id 会变成悬空引用，恢复后落入收件箱。确认文案说明"记录将进入回收站，可在回收站恢复"。

5. **收件箱黄色图标**：`FolderIcon` 加 `text-amber-500`（浅色）+ 深色适配，配"收件箱"文字；有文件夹的仍用 `text-muted-foreground`。

6. **快捷键文字**：去掉 kbd 边框/背景，`text-[12px] font-medium text-muted-foreground`，`shrink-0 self-center`。

## 兼容性

- Category 旧文档无 `defaultLanguage` 字段 → `undefined`，行为回退全局语言，无需迁移。
- 导入导出：`Category` 序列化自动带新字段，无需改动 import-export。