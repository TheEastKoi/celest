# Celest — 开发日志

> 记录每次开发的产出，按日期倒序。

---

## 2026-05-20

### 会话 #6 — Phase 2: 聊天核心强化

**改动文件:**
- 更新 `src/protocol.ts` — 新增 AcpTextContent / AcpToolCallContent / AcpToolResultContent / AcpReasoningContent 类型
- 更新 `src/chatViewProvider.ts` — 按 content 类型分发消息（tuiText / tuiReasoning / tuiToolCall / tuiToolResult）+ 状态变化转发
- 重写 `src/tuiProcessManager.ts` — 添加自动重试（指数退避，最多 3 次）+ startInternal + onStatusChange
- 重写 `gui/src/components/ChatView.vue` — appendText 原地追加（打字机）+ appendReasoning + addToolCall/updateToolResult + localStorage 持久化
- 更新 `gui/src/App.vue` — 新消息路由（tuiText/tuiReasoning/tuiToolCall/tuiToolResult/tuiStatus/tuiCrashed）+ Stop 按钮
- 更新 `gui/src/components/InputBox.vue` — disabled prop + 禁用样式
- 更新 `gui/src/components/ContextBar.vue` — Props 化（modelName/turnCount/sessionId）
- 更新 `docs/PLAN.md` — Phase 2 标记完成

**新功能:**
1. 流式打字机：ChatView.appendText() 原地追加文本，逐 token 更新无闪烁
2. Thinking 实时流：appendReasoning() 增量追加 reasoning channel
3. 工具调用卡片：显示工具名 + JSON 参数 + 结果（pending/success/error 状态）
4. Stop 按钮：生成中显示红色 ⏹ 按钮，发送 session/cancel
5. 错误自动重试：TUI 异常退出→指数退避重试（2s→4s→8s，最多 3 次）
6. 消息缓存：localStorage 自动保存，防抖 500ms，页面重载后恢复

**构建:** 17.1 KB extension + 210 KB GUI  
**测试:** 7/7 passed  
**提交:** `Phase2`

### 会话 #5 — 日志系统 + 连接状态锁 + 文档

**改动文件:**
- 新增 `src/logger.ts` — 统一 `[Celest]` 前缀
- 更新 `src/extension.ts` — 改用 logger
- 更新 `src/chatViewProvider.ts` — 改用 logger + 连接检查
- 更新 `src/tuiProcessManager.ts` — 改用 logger + `_started` 锁 + `connected` getter
- 更新 `gui/src/App.vue` — `tuiReady` 状态 + "Connecting..." 横幅
- 修复 `src/tuiProcessManager.test.ts` — 匹配新错误文案
- 新增 `docs/BUGLOG.md` `docs/PLAN.md` `docs/CHANGELOG.md`

**构建:** 14.4 KB extension + 207 KB GUI  
**测试:** 7/7 passed  
**提交:** `logger` `fix-connection-guard` `fix-test-msg`

### 会话 #4 — Vue GUI 资源加载修复

**问题:** 手写 HTML 硬编码资源路径，CSP 错误 → 404  
**修复:** 改为读取 Vite 生成的 `index.html`，动态替换路径为 `vscode-resource://`  
**提交:** `fix-html-csp`

### 会话 #3 — ACP JSON-RPC ID 类型修复

**问题:** ACP 返回字符串 `"id":"1"` vs 数字 `1` 不匹配 → 握手超时  
**修复:** `jsonRpcClient.ts` 统一用 `String(id)`  
**提交:** `fix-acp-id-string`

### 会话 #2 — Phase 1 核心实现

**新增文件:**
- `src/protocol.ts` — ACP + app-server 类型 (2.4KB)
- `src/jsonRpcClient.ts` — JSON-RPC 2.0 客户端 (3.2KB)
- `src/tuiProcessManager.ts` — spawn + ACP 握手 (4.7KB)
- `gui/src/components/` — 6 个 Vue 组件
- `vitest.config.ts` + 测试
- `.github/workflows/ci.yml`

**技术选型:** React → Vue 3（运行体积 -50%）  
**构建产物:** 12.6 KB extension + 206 KB GUI  
**提交:** `Phase1`

### 会话 #1 — Phase 0 项目骨架

**创建项目:** `E:\git_code\celest`
- `package.json` — 11 命令 + 2 视图 + 5 快捷键
- `src/extension.ts` `src/chatViewProvider.ts` `src/sessionsTreeProvider.ts` `src/tuiProcessManager.ts`
- `build.mjs` `tsconfig.json` `.vscode/` `assets/icon.svg`
- `AGENTS.md` `ARCHITECTURE.md` `README.md`
- Git 仓库 + 强制推送到 `github.com/TheEastKoi/celest`
- **构建产物:** 8.1 KB extension

---

## 构建历史

| 日期 | Extension | GUI | 测试 | Commit |
|------|-----------|-----|------|--------|
| 05-20 | 17.1 KB | 210 KB | 7/7 | `Phase2` |
| 05-20 | 14.4 KB | 207 KB | 7/7 | `e19462f` |
| 05-20 | 14.4 KB | 207 KB | 7/7 | `ebb0d41` |
| 05-20 | 12.6 KB | 206 KB | 7/7 | `9c09b51` |
| 05-20 | 12.6 KB | 206 KB | 7/7 | `1c60a57` |
| 05-20 | 12.6 KB | 206 KB | 7/7 | `f1f780a` |
| 05-20 | 12.6 KB | 206 KB | 7/7 | `c0fe932` |
| 05-20 | 8.2 KB | 210 KB | 6/6 | `a9acb54` |
| 05-20 | 8.1 KB | — | — | `061a256` |
