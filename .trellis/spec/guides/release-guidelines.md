# 发布与版本管理约定

> **Purpose**: 明确本项目的版本标注与 GitHub 推送规范，避免漏打 tag、版本号失联。

---

## 背景

uTools 插件的版本号由发布平台（uTools 开发者工具）填写，`public/plugin.json`
**不包含** `version` 字段。本仓库用 **git tag**（`vX.Y.Z`）作为版本事实来源。

---

## 强制约定

### 1. 推送到 GitHub 时必须同步打 tag

- 每次向 `origin/main` 推送**用户可见的功能更新或修复**时，必须在同一轮操作内
  打上语义化版本 tag，并推送到远程，**不允许只 push 代码不 push tag**。
- 纯内部改动（文档、spec、重构无行为变化）可只打内部 tag 或不打。

### 2. tag 格式与规则

- 格式：`v<major>.<minor>.<patch>`（如 `v1.2.0`）
- 语义化版本：
  - 新增功能 / 用户可见行为变化 → **minor**（`v1.2.0`）
  - 纯修复 → **patch**（`v1.1.1`）
  - 破坏性变更 → **major**
- tag 打在最新提交上，并 push：`git tag vX.Y.Z && git push origin vX.Y.Z`

### 3. package.json 版本同步维护

- `package.json` 的 `"version"` 必须与最近一个 tag 保持一致（当前为 `1.2.0`），
  打新 tag 时同步更新 `package.json` 版本号。
- 该字段不参与构建，仅作为仓库内的一致性参照，避免 tag 与 manifest 失联。

### 4. 参考命令

```bash
# 打 tag 并推送（在最新提交上）
git tag vX.Y.Z
git push origin vX.Y.Z

# 检查最近 tag 与领先提交数
git describe --tags
```

---

## 核对清单（推送前）

- [ ] 是否存在用户可见变更？是 → 必须打 tag
- [ ] tag 版本号符合语义化版本（新增功能 minor / 修复 patch）？
- [ ] `package.json` version 已与 tag 同步？
- [ ] tag 已 push 到远程（`git push origin vX.Y.Z`）？
