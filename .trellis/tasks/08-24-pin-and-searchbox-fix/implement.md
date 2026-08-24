# Implement —— 中栏置顶功能 + 主界面搜索框不显示修复

## 执行顺序：先 B（bug 修复，小步可验证）后 A（功能）

### Step 1: B —— 搜索框竞态修复

1. `src/App.tsx`：onPluginEnter 回调仅保留 `setEnterCode` + `pattern-vault-search` 的 remove（或连 remove 也交给 effect）；新增 enterCode 依赖的渲染 effect 注册主界面 setSubInput（cleanup removeSubInput）
2. `src/components/SearchView.tsx`：不变（保持自管）
3. 编译：`npx tsc -b`
4. 用户验收：往返切换 10 次 + 重启

### Step 2: A —— 置顶功能

1. `src/types.ts`：`PatternRecord` 加 `pinnedAt?: number | null`
2. `src/stores/records.ts`：
   - `load()` 归一化 `pinnedAt = pinnedAt ?? null`
   - 新增 `togglePin(id)`（复用 toggleFavorite 模式：立即 enqueue 落库）
3. `src/lib/search.ts`：`sortByRecent` 置顶组优先（b.pinnedAt - a.pinnedAt），其余保持 updatedAt 倒序
4. `src/components/ListPane.tsx`：
   - 非回收站菜单加置顶项（PinIcon + 文案 toggle）
   - 列表项视觉：pinnedAt 时标题行前置小 PinIcon
5. **检查 `src/lib/import-export.ts`**：导出记录字段若为白名单，补 `pinnedAt`（防置顶丢失）；导入兼容可选
6. 编译 + 构建

### Step 3: 验收（用户实测）

- PRD A/B 验收标准逐条过
- 回归：收藏/分类/标签视图排序、搜索视图、回收站流转

### Step 4: 收尾

- 清理（无临时日志）
- 提交（用户确认后）+ 可选 tag
- spec：置顶排序规则与输入框生命周期收口若值得沉淀 → component-guidelines / state-management
