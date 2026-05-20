# Celest — AI 代码审查规则

> 本文件供 AI（DeepSeek TUI / Claude / Copilot）和人工开发者共同遵守。

## 一、架构边界（不可违）

| 层 | 目录 | 规则 |
|----|------|------|
| **VS Code 适配层** | `src/` | 只负责命令注册、WebView 管理、进程通信。**禁止在此层实现业务逻辑、LLM 调用、工具执行。** |
| **前端 GUI** | `gui/src/` | Vue 3 组件。**禁止直接调用 Node.js API、文件系统、子进程。** 与后端通信只能通过 `postMessage`。 |
| **TUI 后端** | `deepseek-tui` 独立进程 | 不在此仓库。通过 JSON-RPC over stdio 通信。**禁止在插件内重新实现 TUI 的功能。** |

## 二、代码规范

### 2.1 魔鬼代码定义

以下代码将被标记为"魔鬼代码"，不应存在于此项目：

- **God Object**：任何超过 150 行的类，除非有明确的领域边界（如 WebView Provider）
- **Magic Values**：硬编码的字符串/数字，需要提取为常量或有文档注释
- **Nested Callback Hell**：超过 3 层的 `.then()` / 回调嵌套
- **Copy-Paste Duplication**：超过 10 行的重复代码必须提取为共享函数
- **Dead Code**：任何 `Phase X: 待实现` 注释超过 2 周未实现 → 删除，用 issue 跟踪
- **Unhandled Promise**：所有 async 调用必须有 `.catch()` 或 try-catch

### 2.2 TypeScript 严格模式

```typescript
// ✅ 正确
const result: ChatMessage = { role: 'user', content: text };

// ❌ 魔鬼代码
const result: any = { role: 'user', content: text };
```

- 禁止 `any` 类型，除非有注释解释原因
- 所有函数参数必须有显式类型
- 所有 Vue `defineProps` 使用泛型语法

### 2.3 Vue 组件规范

```vue
<!-- ✅ 正确：SFC 三部分清晰 -->
<template>...</template>
<script setup lang="ts">...</script>
<style scoped>...</style>

<!-- ❌ 魔鬼代码：混在 template 中的复杂逻辑 -->
<template>
  <div v-if="items.filter(x => x.status === 'active').map(y => y.value).join(',')">
```

- 每个组件的 `<style>` 必须是 `scoped`
- 全局样式统一放在 `App.vue` 或单独的 `global.css`
- 组件文件名使用 PascalCase（`ChatView.vue`）

## 三、测试要求

| 类型 | 覆盖率 | 说明 |
|------|--------|------|
| `src/*.ts` (后端) | ≥ 70% | 单元测试：TUI 进程管理、JSON-RPC 客户端、命令注册 |
| `gui/src/components/*.vue` | ≥ 50% | 组件测试：快照 + 交互测试 |

- 每个 PR 必须包含对应的测试
- 修改已有功能 → 必须先跑已有测试确保不退化

## 四、AI 生成代码的质量门

当 AI 生成了以下内容时，**必须在代码中留下标记**：

```
// @ai-generated: 理由 + 生成日期
```

这可以防止人工审查时误认为所有代码都是手写的。

## 五、提交规范

- `feat(scope): description` — 新功能
- `fix(scope): description` — Bug 修复
- `docs: description` — 文档
- `chore: description` — 构建/依赖/杂项
- Scope 可选：`gui`, `ext`, `tui`, `test`, `ci`

## 六、文档规范

开发过程中必须维护：

| 文件 | 说明 |
|------|------|
| `docs/PLAN.md` | 详细开发计划（防 AI 遗忘进度） |
| `docs/BUGLOG.md` | 问题解决记录（现象→根因→修复） |
| `docs/CHANGELOG.md` | 开发日志（每次会话产出） |

每次修改完成后，如果涉及以下情况，需更新对应文档：
- 新功能 → 更新 `PLAN.md` 勾选完成项
- 修复 bug → 追加 `BUGLOG.md`
- 任何代码变更 → 追加 `CHANGELOG.md`
