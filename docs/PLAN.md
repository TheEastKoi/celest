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

## Phase 2: 聊天核心强化 ✅ (2026-05-20)

**目标:** 流式渲染优化 + 错误恢复 + 消息持久化

- [x] 流式打字机效果优化（appendText 原地追加，无闪烁）
- [x] Thinking block 实时流（appendReasoning，reasoning channel）
- [x] ✅ 协议升级 ACP → HTTP/SSE（原生流式，零源码修改 deepseek-tui）
- [x] 工具调用卡片：显示工具名 + 参数 + 结果预览
- [x] 错误自动重试机制（TUI 进程崩溃→指数退避自动重启，最多 3 次）
- [x] 消息本地缓存（localStorage 持久化，500ms 防抖写入）
- [x] 停止生成按钮（⏹ Stop 按钮，发送 session/cancel）
- [x] protocol.ts 类型完善（AcpTextContent / AcpToolCallContent / AcpToolResultContent / AcpReasoningContent）
- [x] 后端消息路由适配（chatViewProvider 按 content 类型分发 tuiText / tuiReasoning / tuiToolCall / tuiToolResult）
- [x] InputBox disabled 状态支持
- [x] `test/phase2_verify.py` — 自动化验证脚本（13 项检查）
- [x] `docs/TEST_PLAN.md` — 全面测试方案文档
- [x] `docs/INTEGRATION_TEST.md` — 集成测试用例清单（50+ 项）
- [x] UI 优化：多行自动扩展输入框 + Stop 浮动右上角 + 模拟打字机 fallback
- [x] 调试日志：`[DEBUG]` 标记记录 session/update 实际内容结构

## Phase 3: @ / / + 面板 ✅ (2026-05-21)

**目标:** 在 WebView 中实现 TUI 的交互特性

- [x] @ 提及自动补全（文件/符号）— AtMentionPopup.vue + chatViewProvider.getWorkspaceFiles()
- [x] / 命令列表（/help /compact /clear /model /review）— SlashCommandPopup.vue
- [x] Work 面板（解析 todo_write ToolCallResult）— WorkPanel.vue + chatViewProvider toolName 映射
- [x] Plan 面板（解析 update_plan ToolCallResult）— PlanPanel.vue + App.vue Tab 布局
- [x] 会话列表 TreeView 接入真实数据 — sessionsTreeProvider + tuiProcessManager.listThreads()

**新增文件：**
- `gui/src/components/AtMentionPopup.vue` — @ 文件提及弹窗（搜索过滤 + 键盘导航）
- `gui/src/components/SlashCommandPopup.vue` — / 命令弹窗（6 个预定义命令）
- `gui/src/components/WorkPanel.vue` — Work 面板（todo_write 解析显示）
- `gui/src/components/PlanPanel.vue` — Plan 面板（update_plan 解析显示）

**修改文件：**
- `gui/src/components/InputBox.vue` — 集成 @ / 弹窗（检测 + 替换 + 键盘导航）
- `gui/src/App.vue` — Tab 布局（Chat/Work/Plan）+ 文件列表 + Work/Plan 数据解析
- `src/chatViewProvider.ts` — 添加 getWorkspaceFiles() + toolNameMap 维护
- `src/tuiProcessManager.ts` — 添加 listThreads() HTTP API
- `src/sessionsTreeProvider.ts` — 接入真实 thread 数据源码

## Phase 4: 审批 + 执行 ✅ (完成, 2026-05-24)

**目标:** 工具执行的用户确认流程

### 4.1 审批事件处理 ✅ (2026-05-23)
- [x] `tuiProcessManager.ts` — `auto_approve` 改为可配置（默认 `false`）
- [x] SSE `approval.required` 事件处理 → `onApprovalRequired` 发射
- [x] `decideApproval(approvalId, decision, remember)` → `POST /v1/approvals/{id}`
- [x] `approval.decided` / `approval.timeout` 事件处理

### 4.2 审批 UI ✅ (2026-05-24)
- [x] `ApprovalPopup.vue` — 类 TUI 终端 UI，数字键/上下键选择 + Enter 确认 + Esc 返回
- [x] 三种决策：允许本次 / 信任会话 / 拒绝，含二次确认状态
- [x] 工具元数据展示：类型、影响（颜色编码）、参数（缓存匹配）
- [x] 中文汉化（标题/按钮/倒计时/确认文案）

### 4.3 消息路由 ✅ (2026-05-24)
- [x] `chatViewProvider.ts` — `tuiApprovalRequired` / `tuiApprovalDecided` / `tuiApprovalTimeout` 消息
- [x] WebView `approvalDecision` 消息 → TUI API
- [x] `App.vue` — 审批状态管理 + 弹窗集成
- [x] `autoApprove=true` 时自动过滤冗余弹窗

### 4.4 核心 Bug 修复 ✅ (2026-05-24)
- [x] SSE 外层包装解包 — `approval.required` 字段全部为空的根因
- [x] `trust_mode: false` — 关闭默认信任，启用审批流程
- [x] `_autoApprove` 提前设置 — 不依赖 TUI HTTP 返回值
- [x] turn 创建请求同步携带 `auto_approve` 参数
- [x] 审批工具参数缓存 — 按工具名跨事件关联（item_xxx ≠ call_xxx）
- [x] 审批决策 404 保护 — 三层 `resp.json()` 异常防护
- [x] `approvalDecided`/`approvalTimeout` 同源解包修复

### 4.5 Shell 输出 + Diff ✅ (2026-05-24)
- [x] Shell 输出流式追加 — `updateToolResult` pending 状态追加而非覆盖
- [x] `toolProgress` 补传 `itemId` 以匹配 tool card
- [x] View Diff — VS Code diff editor 集成，git show HEAD 获取旧版
- [x] `edit_file` 传 search/replace 作为 diff 预览
- [x] git 不可用时显示空旧侧，不 fallback 到相同文件

### 4.6 Tasks 面板 ✅ (2026-05-24)
- [x] `TasksPanel.vue` — 对接 `GET /v1/tasks` API，状态圆点 + 中文标签
- [x] 自动刷新机制 — `toolCompleted`/`turnCompleted` 触发 + prompt 期间 5s 保底轮询
- [x] 空状态统一中文风格（与 Work/Plan 对齐）
- [x] `/clear` 和 `newSession` 同步清空三个面板

## Phase 5: 配置 + 模型 + 国际化 ✅ (2026-05-24)

**目标:** 设置面板 + 模型切换 + API Key 安全存储 + 二进制自动下载 + i18n

### 5.1 核心调研
- [x] TUI REST API 审计：确认不存在 `app/config/set` RPC，改用 thread-level model + PATCH
- [x] 模型切换方案：通过 `CreateThreadRequest.model` / `StartTurnRequest.model` / `PATCH /v1/threads/{id}`
- [x] API Key 方案：VS Code SecretStorage + 环境变量 `DEEPSEEK_API_KEY`

### 5.2 新增文件
- [x] `src/secretStorage.ts` — SecretStore 类，封装 VS Code SecretStorage API
- [x] `src/binaryDownloader.ts` — BinaryDownloader 类，GitHub Release 下载 + 流式进度
- [x] `gui/src/components/SettingsPanel.vue` — 设置面板（通用/模型/关于三 Tab）
- [x] `gui/src/i18n.ts` — 轻量 i18n 模块（zh-CN / en），零依赖

### 5.3 模型 + 模式切换
- [x] `tuiProcessManager.ts` — `SessionConfig` 接口 (model/mode) + `setConfig()` / `getConfig()` / `updateThreadConfig()`
- [x] Mode 切换：ContextBar 点击循环 agent/plan/yolo，PATCH 同步当前线程
- [x] yolo 模式自动设置 `autoApprove=true`，跳审；agent/plan 恢复审批
- [x] `sendPrompt()` 从 `config.model` 读取模型名（不再硬编码）
- [x] `App.vue` — 头部模型下拉选择器 + `switchModel` 消息
- [x] `chatViewProvider.ts` — `switchModel` 消息处理 + PATCH thread

### 5.4 API Key 安全存储
- [x] SecretStore 读写 API Key / Provider / BaseUrl
- [x] `extension.ts` 启动时异步加载 API Key → `tuiManager.setConfig()`
- [x] `tuiProcessManager.ts` spawn 时传递 `DEEPSEEK_API_KEY` 环境变量
- [x] SettingsPanel.vue 显示 Key 状态（已设置/未设置）+ 编辑

### 5.5 二进制自动下载
- [x] BinaryDownloader: GitHub Release API → 流式下载 → 验证
- [x] 平台检测（win/mac/linux）+ arch 检测（x86_64/aarch64）
- [x] 下载进度事件发射 → 前端显示
- [x] `extension.ts` 启动时检测 + 提示下载
- [x] 手动选择二进制路径（browseBinary）

### 5.6 i18n 国际化
- [x] `celest.locale` 配置项（zh-CN / en）
- [x] 135 条翻译 key（设置/模型/二进制/公共 UI）
- [x] `getAvailableModels()` / `getReasoningEfforts()` 辅助函数
- [x] 设置变更时即时切换语言（`localeChanged` 消息）

### 5.7 配置项扩展
- [x] `celest.locale` — UI 语言
- [x] `celest.provider` — API 提供商
- [x] `celest.reasoningEffort` — 推理深度
- [x] `celest.downloadBinary` — 下载命令
- [x] `extension.ts` 配置变化监听器（`onDidChangeConfiguration`）

## Phase 6: API 全面适配 + 打磨 + 发布 ⏳ (进行中)

**目标:** 基于 CodeWhale v0.8.45 Runtime API 审计，补齐所有遗漏接口，完善 Skills（插件）适配，打磨体验并准备发布。

### 🔑 增量开发铁律

> **Phase 0-5 所有代码均经过测试，Phase 6 严格遵守以下原则：**
> 1. **只增不改** — 在 `tuiProcessManager.ts` 中追加方法，不修改已有方法签名和逻辑
> 2. **只加不删** — 在 `chatViewProvider.ts` 中追加消息类型和 case 分支，不删除已有处理
> 3. **新文件优先** — 新功能尽量放新 Vue 组件，尽量不改 `App.vue` / `ChatView.vue` 核心结构
> 4. **遇改必问** — 如果必须修改已有代码，先停下来向用户确认
> 5. **回归零容忍** — 每次新增后跑 `npm test` + `npm run compile` 确保已有功能不退化

---

## 📊 2026-05-27 审查：CodeWhale v0.8.45 全量 API 审计

> 对比源：`DeepSeek-TUI-new/crates/tui/src/runtime_api.rs` (3767行) + `docs/RUNTIME_API.md`
> celest 当前代码库：`src/tuiProcessManager.ts` (600行)

### TUI Runtime API 完整清单 (37+ 端点)

#### ✅ 已适配 (10个)

| # | 端点 | celest 方法 | Phase |
|---|------|------------|-------|
| 1 | `GET /health` | `waitForReady()` | 1 |
| 2 | `GET /v1/runtime/info` | `getRuntimeInfo()` | 5 |
| 3 | `GET /v1/threads` | `listThreads()` | 3 |
| 4 | `POST /v1/threads` | `sendPrompt()` | 2 |
| 5 | `PATCH /v1/threads/{id}` | `updateThreadConfig()` | 5 |
| 6 | `POST /v1/threads/{id}/turns` | `sendPrompt()` | 2 |
| 7 | `GET /v1/threads/{id}/events` | `streamEvents()` | 2 |
| 8 | `POST /v1/threads/{id}/turns/{turn_id}/interrupt` | `cancel()` | 3 |
| 9 | `POST /v1/approvals/{approval_id}` | `decideApproval()` | 4 |
| 10 | `GET /v1/tasks` | `listTasks()` | 4 |

#### ❌ 未适配 (27个) — 按优先级分类

**🔴 P0 — Phase 6.1 必须适配（核心体验 + Skills 插件）**

| # | 端点 | 用途 | 适配方案 |
|---|------|------|---------|
| 11 | `GET /v1/usage` | 用量统计 | UsagePanel.vue + `getUsage()` |
| 12 | `GET /v1/skills` | 技能列表 | SkillsPanel.vue + `listSkills()` |
| 13 | `POST /v1/skills/{name}` | 启用/禁用技能 | `setSkillEnabled()` |
| 14 | `POST /v1/threads/{id}/compact` | 压缩对话 | `/compact` 命令 → RPC 调用 |
| 15 | `GET /v1/workspace/status` | 工作区 Git 状态 | `getWorkspaceStatus()` |

**🟡 P1 — Phase 6.2 建议适配（体验提升）**

| # | 端点 | 用途 | 适配方案 |
|---|------|------|---------|
| 16 | `GET /v1/sessions` | 会话历史 | Sessions 面板迁移 |
| 17 | `GET /v1/sessions/{id}` | 会话详情 | 恢复历史会话 |
| 18 | `DELETE /v1/sessions/{id}` | 删除会话 | 会话管理 |
| 19 | `POST /v1/sessions/{id}/resume-thread` | 恢复会话到线程 | 历史会话恢复 |
| 20 | `GET /v1/threads/summary` | 线程摘要 | 优化列表加载 |
| 21 | `GET /v1/threads/{id}` | 线程详情 | 恢复/检查状态 |
| 22 | `POST /v1/threads/{id}/resume` | 恢复线程 | 断线重连 |
| 23 | `POST /v1/threads/{id}/turns/{turn_id}/steer` | Steer turn | 高级用户 |
| 24 | `POST /v1/tasks` | 创建后台任务 | Tasks CRUD |
| 25 | `GET /v1/tasks/{id}` | 任务详情 | Tasks CRUD |
| 26 | `POST /v1/tasks/{id}/cancel` | 取消任务 | Tasks CRUD |

**🟢 P2 — Phase 6.3 展示性适配（只读展示）**

| # | 端点 | 用途 | 适配方案 |
|---|------|------|---------|
| 27 | `GET /v1/apps/mcp/servers` | MCP 服务器列表 | Settings→MCP Tab |
| 28 | `GET /v1/apps/mcp/tools` | MCP 工具列表 | Settings→MCP Tab |

**⚪ P3 — 后续版本（Automations 等高级功能）**

| # | 端点组 | 端点数量 | 
|---|--------|---------|
| 29-37 | `/v1/automations/*` | 9个端点 |
| — | `POST /v1/threads/{id}/fork` | fork 线程 |
| — | `POST /v1/stream` | 旧版兼容 API（已被 threads API 取代） |

### SSE 事件类型适配情况

| 事件 | celest 处理 | 状态 |
|------|-----------|------|
| `thread.started` | ❌ | P1 — 获取 thread_id |
| `thread.forked` | ❌ | P3 |
| `turn.started` | ❌ | P1 — 获取 turn_id（当前从 turn 响应取） |
| `turn.lifecycle` | ❌ | P2 |
| `turn.steered` | ❌ | P3 |
| `turn.interrupt_requested` | ❌ | P2 |
| `turn.completed` | ✅ | 已处理 |
| `item.started` | ✅ | agent_reasoning/tool_call/command_execution/file_change |
| `item.delta` | ✅ | agent_reasoning/agent_message/tool_call |
| `item.completed` | ✅ | turnCompleted 事件 |
| `item.failed` | ✅ | toolFailed 事件 |
| `item.interrupted` | ❌ | P2 — 中断提示 |
| `approval.required` | ✅ | onApprovalRequired 发射 |
| `approval.decided` | ✅ | approvalDecided 消息 |
| `approval.timeout` | ✅ | approvalTimeout 消息 |
| `sandbox.denied` | ❌ | P1 — 沙箱拒绝提示 |
| `coherence.state` | ❌ | P3 |

---

## Phase 6.1: 核心遗漏 API 适配 (P0) ✅ (2026-05-27)

### 6.1.1 Skills（插件）管理 ✅

**调研结论：** CodeWhale Skills 是 TUI 内置的"插件"系统，类似 prompt 模板/工具集封装。
Celest 作为 VSCode 扩展需要提供 Skills 管理界面。

**新增后端方法 (tuiProcessManager.ts)：**
- [x] `listSkills(): Promise<SkillsListResponse | null>` — `GET /v1/skills`
- [x] `setSkillEnabled(name: string, enabled: boolean): Promise<boolean>` — `POST /v1/skills/{name}`
- [x] `SkillEntry` / `SkillsListResponse` 接口定义

**新增前端组件：**
- [x] `gui/src/components/SkillsPanel.vue` — 技能列表 + 开关
  - 展示所有技能（名称/描述/路径/状态）
  - 开关按钮启用/禁用技能

**修改文件（最小化）：**
- [x] `gui/src/App.vue` — Tab 栏增加 "Skills" 标签（新增，不修改现有 Tab）
- [x] `src/chatViewProvider.ts` — 新增 `getSkills` / `toggleSkill` 消息处理
- [x] `gui/src/i18n.ts` — 新增 `panel.skills` 翻译 key（zh-CN: 技能 / en: Skills）

**文件变更清单：**
| 操作 | 文件 | 说明 |
|------|------|------|
| 新增 | `gui/src/components/SkillsPanel.vue` | Skills 管理面板 |
| 修改 | `src/tuiProcessManager.ts` | 追加 listSkills() / setSkillEnabled() |
| 修改 | `src/chatViewProvider.ts` | 追加 getSkills / toggleSkill case |
| 修改 | `gui/src/App.vue` | Tab 栏追加 Skills |
| 修改 | `gui/src/i18n.ts` | 追加 Skills 翻译 |

### 6.1.2 用量统计面板 ✅ (后端 API 已完成，前端面板待 Phase 6.3)

**新增后端方法 (tuiProcessManager.ts)：**
- [x] `getUsage(query?: UsageQuery): Promise<UsageData | null>` — `GET /v1/usage`
- [x] `UsageData` / `UsageBucket` / `UsageQuery` 接口

**前端面板：**
- [ ] `gui/src/components/UsagePanel.vue` — (延后到 Phase 6.3，与 MCP 展示合并)

**文件变更清单：**
| 操作 | 文件 | 说明 |
|------|------|------|
| 新增 | `gui/src/components/UsagePanel.vue` | 用量统计面板 |
| 修改 | `src/tuiProcessManager.ts` | 追加 getUsage() |
| 修改 | `src/chatViewProvider.ts` | 追加 getUsage 消息处理 |
| 修改 | `gui/src/App.vue` | Tab 栏追加 Usage（可选，也可集成到 Settings About Tab） |

### 6.1.3 /compact 命令 → REST API 适配 ✅

- [x] `tuiProcessManager.ts` 追加 `compactThread(threadId, reason?): Promise<boolean>` — `POST /v1/threads/{id}/compact`
- [x] 前端 App.vue `handleSend` 中拦截 `/compact`，直接调用 `compactThread` API
- [x] 后端 chatViewProvider.ts `sendPrompt` 中增加 `/compact` 双保险判定
- [x] 成功后显示 "✅ Context compacted"，失败显示错误信息

**文件变更清单：**
| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `src/tuiProcessManager.ts` | 追加 compactThread() |
| 修改 | `src/chatViewProvider.ts` | handleWebviewMessage sendPrompt 增加 /compact 判定 |

### 6.1.4 工作区状态 ✅

- [x] `tuiProcessManager.ts` 追加 `getWorkspaceStatus(): Promise<WorkspaceStatus | null>` — `GET /v1/workspace/status`
- [x] `gui/src/components/ContextBar.vue` 右下角增加 Git 分支/状态标识 ✅ (2026-05-27)
  - ContextBar 新增 `gitBranch` / `gitDirty` props，显示 `⎇ main*` 格式
  - 移除旧的独立 git-status-bar 重复元素

### 6.1.5 新 SSE 事件适配 ✅ (部分，chatViewProvider 端已完成)

- [x] `sandbox.denied` → 前端 `tuiWarning` 消息
- [x] `turn.started` → 前端 `turnStarted` 消息（含 turnId）
- [x] `item.interrupted` → 前端 `tuiWarning` 消息
- [x] 前端 ChatView.vue 渲染 toast ✅ (2026-05-27) — `tuiWarning` 消息 → 内联 `⚠️` 提示

---

## Phase 6.2: 增强适配 (P1) ✅ (2026-05-27)

### 6.2.1 Sessions 会话管理 ✅ (后端 API)

- [x] `tuiProcessManager.ts` 追加：
  - `listSessions(limit?, search?): Promise<SessionMetadata[]>`
  - `getSession(id: string): Promise<SessionDetail | null>`
  - `deleteSession(id: string): Promise<boolean>`
  - `resumeSessionThread(id, model?, mode?): Promise<ResumeSessionResult | null>`
- [ ] sessionsTreeProvider 增强：右键菜单（延后到 Phase 6.3）
- [ ] 前端 Sessions 面板（延后到 Phase 6.3）

### 6.2.2 Threads 增强 ✅ (后端 API)

- [x] `tuiProcessManager.ts` 追加：
  - `getThread(id: string): Promise<ThreadDetail | null>`
  - `getThreadSummary(limit?, search?): Promise<ThreadSummary[]>`
  - `resumeThread(id, model?, mode?): Promise<ThreadSummary | null>`
- [x] sessionsTreeProvider 使用 summary API 加速加载 ✅ (2026-05-27)

### 6.2.3 Tasks CRUD ✅ (后端 API)

- [x] `tuiProcessManager.ts` 追加：
  - `createTask(params: NewTaskRequest): Promise<Record<string, unknown> | null>`
  - `getTask(id: string): Promise<Record<string, unknown> | null>`
  - `cancelTask(id: string): Promise<boolean>`
- [ ] TasksPanel.vue 增强：右键菜单（延后到 Phase 6.3）

### 6.2.4 Steer / Interrupt 补充 ✅ (后端 API)

- [x] `tuiProcessManager.ts` 追加 `steerTurn(threadId, turnId, prompt): Promise<boolean>`
- [x] SSE `turn.interrupt_requested` 事件 → 前端 `tuiWarning` ✅ (2026-05-27)

---

## Phase 6.3: 面板对齐 + 打磨 + 发布 ⏳ (进行中)

### 🔍 TUI 0.8.45 右侧面板审计

TUI `SidebarFocus` 枚举定义了 5 种面板：

| TUI 面板 | Celest 现状 | 对齐方案 |
|----------|------------|---------|
| **Work** | ✅ WorkPanel | 保持不变 |
| **Tasks** | ✅ TasksPanel | 保持不变 |
| **Agents** (子代理) | ❌ 缺失 | **新增 AgentsPanel** |
| **Context** (上下文) | ❌ 缺失 | **新增 ContextPanel** |
| (隐藏) | — | — |
| — | 📐 **PlanPanel** | TUI 无独立 Plan（Plan 合在 Work 中），保留为 Celest 增强 |
| — | 🧩 **SkillsPanel** | Celest 独有，保留 |
| — | 📖 **HelpPanel** | Celest 独有，保留 |

**Agents 面板数据来源：** SSE 事件 `agent.spawned` / `agent.progress` / `agent.completed`（EngineEvent → RuntimeEventRecord）
**Context 面板数据来源：** `GET /v1/usage` + `GET /v1/workspace/status` + `GET /v1/apps/mcp/servers`

### 6.3.1 右侧面板对齐：Agents + Context ✅ (2026-05-27)

**新增后端：**
- [x] `tuiProcessManager.ts` 追加 `listMcpServers()` / `listMcpTools()`
- [x] `chatViewProvider.ts` 新增 agent SSE 事件监听（`agent.spawned` → `agentSpawned`, `agent.progress` → `agentProgress`, `agent.completed` → `agentCompleted`）
- [x] `dispatchRawEvent` 新增 agent 事件 case

**新增前端组件：**
- [x] `gui/src/components/AgentsPanel.vue` — 子代理列表（名称/状态/提示/结果摘要）
- [x] `gui/src/components/ContextPanel.vue` — 上下文仪表盘（token 用量/Git 状态/MCP 服务器数）

**修改文件（最小化）：**
- [x] `gui/src/App.vue` — Tab 栏增加 Agents + Context 折叠面板 + agent 状态管理 + workspaceStatus/mcpStatus 消息处理
- [x] `gui/src/i18n.ts` — 新增 panel.agents / panel.context 翻译（zh-CN: 子代理/上下文 / en: Agents/Context）

### 6.3.2 MCP 展示 ✅

- [x] `tuiProcessManager.ts` 追加 `listMcpServers()` / `listMcpTools()`
- [x] ContextPanel 中整合 MCP 状态展示（服务器计数）
- [x] `chatViewProvider.ts` 新增 `getMcpStatus` 消息处理

### 6.3.3 主题 + 打磨

- [ ] VS Code 主题适配（暗/亮）
- [ ] 快捷键绑定完善

### 6.3.4 单元测试补充 ✅ (2026-05-27)

- [x] `tuiProcessManager.test.ts` — 从 7 个扩展到 36 个测试（+29 个）
  - 覆盖 Phase 6.1: Skills/Workspace/Usage/Compact (8个)
  - 覆盖 Phase 6.2: Sessions/Threads/Tasks/Steer (11个)
  - 覆盖 Phase 6.3: MCP (2个)
  - 补充 Phase 5: Config/RuntimeInfo/autoApprove (8个)
- [x] 全部 40 个测试通过 (36 + sessionsTreeProvider 4)

### 6.3.5 CI + 发布

- [ ] `vsce package` + 自动发布 GitHub Action
- [ ] Marketplace 发布

---

**当前进度:** Phase 6.1+6.2+6.3 完成 (28/37 API)，UT 40 个全覆盖，CI 发布待办  
**API 覆盖率:** 10→15→26→28→31→**37 / 37 (100%)** ✅  
**UT:** 46 tests (tuiProcessManager 42 + sessionsTreeProvider 4)  
**最后更新:** 2026-05-27 (全量 API 适配完成 + Fork + Automations 写操作 + UT)  
**最后更新:** 2026-05-27 (本轮: ContextBar Git + turn.interrupted + tuiWarning + summary API)

---

## 🔄 CodeWhale 迁移 (2026-05-25 → 2026-05-27)

TUI 项目从 `deepseek-ai/DeepSeek-TUI` v0.8.40 升级到 `Hmbown/CodeWhale` v0.8.44 → **v0.8.45**。

| 项目 | 旧值 | 新值 |
|------|------|------|
| 二进制名 | `deepseek-tui` | `codewhale-tui` |
| 启动命令 | `serve --http --port X --host Y --insecure` | 不变 |
| 默认端口 | 7878 | 8787 |
| Release 资产名 | `deepseek-tui-windows-x64.exe` | `codewhale-tui-windows-x64.exe` |
| Runtime API | 10 端点 | 37+ 端点（大量新增 Skills/MCP/Automations/Sessions） |

**相关修改：**
- `tuiProcessManager.ts` — spawn 命令不变，二进制查找改为 `codewhale-tui`，端口 8787
- `binaryDownloader.ts` — GitHub URL → `Hmbown/CodeWhale`，资产名改为 `codewhale-tui-*`

---

## 🔍 2026-05-21 审查：DeepSeek-TUI 0.8.40 API 兼容性分析

> 基于 `DeepSeek-TUI-new` (v0.8.40, `crates/tui/src/runtime_api.rs`) 的最新 Runtime API 路由。

### ✅ 已验证兼容

| celest 调用 | 实际端点 | 状态 |
|-------------|---------|------|
| `GET /health` | `GET /health` | ✅ 一致 |
| `GET /v1/threads` | `GET /v1/threads` | ✅ 一致 |
| `POST /v1/threads` | `POST /v1/threads` | ✅ 一致 |
| `POST /v1/threads/{id}/turns` | `POST /v1/threads/{id}/turns` | ✅ 一致 |
| `GET /v1/threads/{id}/events?since_seq=0` | `GET /v1/threads/{id}/events?since_seq=0` | ✅ 一致 |

### ⚠️ 需要修复

#### 1. Cancel 机制 — AbortController → interrupt API ✅ 已修复

**现状:** celest 用 `AbortController` 暴力断开 SSE 连接来中断生成。服务端可能继续运行。

**实际 API:** `POST /v1/threads/{id}/turns/{turn_id}/interrupt` — 优雅地中断 turn。

**修复 (2026-05-21):** 
- tuiProcessManager 新增 `_currentThreadId` / `_currentTurnId` 字段
- sendPrompt() 保存 threadId + turnId
- cancel() 先发送 `POST .../interrupt`，失败时 fallback to `AbortController.abort()`
- 导出 `ThreadSummary` 接口供 sessionsTreeProvider 使用

#### 2. ThreadRecord 数据结构不匹配 ✅ 已修复

**现状:** celest 假设 `preview`/`name`/unix timestamp 字段  
**实际:** `title`(Option) + ISO 8601 DateTime + `latest_turn_id` + 无 `preview`

**修复 (2026-05-21):**
- `ThreadSummary` 接口匹配实际字段（id/title/created_at/updated_at/model/mode）
- sessionsTreeProvider 使用 `t.title` 显示会话名，fallback 到 `Thread {id[0..8]}`
- `formatDate()` 方法解析 ISO 8601 → 本地化短日期（`new Date(iso)`）
- tooltip 增加 Model/Mode 信息

#### 3. 未利用的新 API

| 端点 | 用途 | Phase |
|------|------|-------|
| `POST /v1/threads/{id}/turns/{turn_id}/interrupt` | 优雅 cancel | 3.x ✅ |
| `POST /v1/threads/{id}/compact` | 压缩对话 | - |
| `GET /v1/threads/summary` | 线程摘要 | - |
| `POST /v1/approvals/{id}` | 审批决策 | 4 ✅ |
| `GET /v1/runtime/info` | 运行时信息 | 5 ✅ |
| `GET /v1/workspace/status` | 工作区状态 | - |
| `PATCH /v1/threads/{id}` | 更新 thread 配置 | 5 ✅ | 
| `GET /v1/sessions` | 会话列表 | - |
| `GET /v1/skills` | 技能列表 | - |
| `GET /v1/usage` | 用量统计 | - |
| *(新增 v0.8.44+)* | *Skills/MCP/Automations/Sessions CRUD 等 20+ 端点* | *见上方全量审计* |

#### 4. 模型切换方案 (Phase 5 调研) ✅

**TUI 无全局 `config/set` 端点。** 模型切换通过以下方式实现：
- `CreateThreadRequest.model` — 创建线程时指定模型
- `StartTurnRequest.model` — 发送 prompt 时指定模型
- `PATCH /v1/threads/{id}` — 更新现有线程模型 
- API Key 通过环境变量 `DEEPSEEK_API_KEY` 传递


---

## 🐛 Phase 3 BUGLOG 索引

| # | 问题 | 状态 |
|---|------|------|
| 1 | / 命令选中后出现双 `//` | ✅ 已修复 |
| 2 | / 命令弹窗滚动条不跟随 | ✅ 已修复 |
| 3 | 截图粘贴无法获得文件路径 | ✅ 已修复 |
| 4 | 首屏加载左右分栏空白 | ✅ 已修复 |
| 5 | VS Code 右键不加 @ | ✅ 已修复 |
| 6 | 工具调用卡片默认展开 | ✅ 已修复 |
| 7 | Tab 切换面板布局歧义 | ✅ 已修复（改为左右分栏） |

详见 `docs/BUGLOG.md`。