# Celest — 详细开发计划

> 防止 AI 遗忘进度的活文档。每次 Phase 完成后更新。

## Phase 0: 项目骨架 ✅ (2026-05-20)

- [x] Git 仓库初始化 → origin: TheEastKoi/celest
- [x] `package.json`（11 命令 + 2 视图 + 5 快捷键 + 4 配置项）
- [x] 入口 `extension.ts`（activate/deactivate + 命令注册）
- [x] WebView 占位 UI（chatViewProvider.ts）
- [x] 会话列表 TreeView 骨架（sessionsTreeProvider.ts）
- [x] esbuild 构建脚本 `build.mjs`
- [x] `.vscode/launch.json` + `tasks.json`
- [x] Moon 图标 `assets/icon.svg`
- [x] README.md + AGENTS.md + ARCHITECTURE.md

## Phase 1: TUI 通信 + Vue GUI ✅ (2026-05-20)

### 1.0 技术选型
- [x] React → Vue 3（运行时 20KB vs 40KB，SFC 更整洁）
- [x] 依赖：vue, markdown-it, highlight.js
- [x] 构建：@vitejs/plugin-vue

### 1.1 协议层
- [x] `protocol.ts` — ACP + app-server 类型定义
- [x] `jsonRpcClient.ts` — JSON-RPC 2.0 客户端 (stdio)
- [x] **BUGFIX:** ACP 返回字符串 ID `"1"` vs 数字 `1` 不匹配

### 1.2 进程管理
- [x] `tuiProcessManager.ts` — spawn `deepseek-tui serve --acp`
- [x] ACP 握手：initialize → agentInfo.name + version
- [x] 会话创建：session/new → sessionId
- [x] `sendPrompt` → session/prompt
- [x] `cancel` → session/cancel
- [x] **BUGFIX:** 连接状态锁 + 前端 Connecting UI

### 1.3 Vue GUI（6 组件）
- [x] `App.vue` — 根布局 + WebView 消息路由
- [x] `ChatView.vue` — 消息列表（user/assistant + tool_call 卡片）
- [x] `InputBox.vue` — 输入框（@ / 检测骨架）
- [x] `MarkdownRenderer.vue` — markdown-it + highlight.js
- [x] `ThinkingBlock.vue` — 折叠可展开
- [x] `ContextBar.vue` — 底部模型名/轮次/会话 ID

### 1.4 测试体系
- [x] Vitest 配置 + vscode mock
- [x] 7 个单元测试全部通过
- [x] GitHub Actions CI（`.github/workflows/ci.yml`）

### 1.5 开发工具
- [x] `build.bat` — 一键构建（自动设 PATH）
- [x] `test.bat` — 一键测试
- [x] `logger.ts` — 统一 `[Celest]` 前缀日志
- [x] `tmp/test-simple.js` — 命令行 TUI 连通性测试
- [x] `tmp/test-full.js` — 完整 ACP 流程测试
- [x] `tmp/test-debug.js` — 原始 stdio 调试脚本

### 1.6 文档
- [x] `AGENTS.md` — AI 代码规范（架构边界 + 魔鬼代码定义）
- [x] `ARCHITECTURE.md` — 系统架构 + 模块清单
- [x] `docs/BUGLOG.md` — 问题解决记录
- [x] `docs/CHANGELOG.md` — 开发日志
- [x] `docs/PLAN.md` — 本文件

## Phase 2: 聊天核心强化 ⏳ (未开始)

**目标:** 流式渲染优化 + 错误恢复 + 消息持久化

- [ ] 流式打字机效果优化（逐字追加无闪烁）
- [ ] Thinking block 实时流（reasoning channel）
- [ ] 工具调用卡片：显示工具名 + 参数 + 结果预览
- [ ] 错误自动重试机制（TUI 进程崩溃→自动重启）
- [ ] 消息本地缓存（IndexedDB / localStorage）
- [ ] 停止生成按钮（发送 cancel）

**依赖:** 可能需要修改 app-server 添加 `prompt/stream` (流式 EventFrame)

## Phase 3: @ / / + 面板 ⏳ (未开始)

**目标:** 在 WebView 中实现 TUI 的交互特性

- [ ] @ 提及自动补全（文件/符号）
- [ ] / 命令列表（/help /compact /clear /model /review）
- [ ] Work 面板（解析 todo_write ToolCallResult）
- [ ] Plan 面板（解析 update_plan ToolCallResult）
- [ ] 会话列表 TreeView 接入真实数据

## Phase 4: 审批 + 执行 ⏳ (未开始)

**目标:** 工具执行的用户确认流程

- [ ] 审批弹窗（ExecApprovalRequest → VS Code QuickPick / Modal）
- [ ] Shell 输出实时流（exec_command_output_delta）
- [ ] Patch 应用展示 + VS Code Diff Editor
- [ ] 批准/拒绝/会话级批准 三种决策

## Phase 5: 配置 + 模型 ⏳ (未开始)

**目标:** 设置面板 + 模型切换

- [ ] SettingsPanel.vue — 配置界面
- [ ] API Key 安全存储（VS Code SecretStorage）
- [ ] 模型列表 → 下拉选择器
- [ ] 模型切换（RPC: app/config/set）
- [ ] 二进制自动下载（首次使用时从 GitHub Release 下载）

## Phase 6: 打磨 + 发布 ⏳ (未开始)

- [ ] VS Code 主题适配（暗/亮）
- [ ] 快捷键绑定完善
- [ ] `vsce package` + 自动发布 GitHub Action
- [ ] deepseek-tui 多平台编译 CI
- [ ] Marketplace 发布

---

**当前进度:** Phase 1 完成，待进入 Phase 2  
**最后更新:** 2026-05-20 (commit `e19462f`)
