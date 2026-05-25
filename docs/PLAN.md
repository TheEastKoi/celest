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

## Phase 6: 打磨 + 发布 ⏳ (未开始)

- [ ] VS Code 主题适配（暗/亮）
- [ ] 快捷键绑定完善
- [ ] `vsce package` + 自动发布 GitHub Action
- [ ] deepseek-tui 多平台编译 CI
- [ ] Marketplace 发布
- [ ] 端到端测试套件完善

---

**当前进度:** Phase 5 完成，待进入 Phase 6  
**最后更新:** 2026-05-25 (CodeWhale v0.8.44 迁移)

---

## 🔄 CodeWhale 迁移 (2026-05-25)

TUI 项目从 `deepseek-ai/DeepSeek-TUI` v0.8.40 升级到 `Hmbown/CodeWhale` v0.8.44。

| 项目 | 旧值 | 新值 |
|------|------|------|
| 二进制名 | `deepseek-tui` | `codewhale-tui` |
| 启动命令 | `serve --http --port X --host Y --insecure` | 不变 |
| 默认端口 | 7878 | 8787 |
| Release 资产名 | `deepseek-tui-windows-x64.exe` | `codewhale-tui-windows-x64.exe` |
| Runtime API | 不变 | 不变 |

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
