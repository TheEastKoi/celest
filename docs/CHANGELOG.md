## 2026-06-07 (v0.1.11) — 最终版本

> **本项目即日起暂停更新。** 感谢所有用户的试用和支持。

### 新增

- **Provider 生态同步** — 对齐 CodeWhale TUI v0.8.53，全量 24 个 Provider 支持：
  DeepSeek / OpenAI / NVIDIA NIM / Ollama / Hugging Face / Arcee AI / Moonshot (Kimi) / SGLang / vLLM / SiliconFlow (国际站+中国站) / Fireworks AI / Xiaomi MiMo / Wanjie Ark / Volcengine Ark / OpenRouter / Novita AI / AtlasCloud / DashScope (阿里云百炼)
- **Provider 配置管理** — 设置面板新增 Provider 凭证页，为每个 Provider 独立配置 API Key、Base URL、默认模型，凭证安全存储在系统密钥链
- **API Path Suffix** — 新增 `celest.pathSuffix` 配置项，支持自建网关或非标准端点的路径覆写
- **端口冲突自动重试** — TUI 进程启动时检测端口冲突，自动重试最多 3 次
- **ToolCache 优化** — 5 分钟 TTL 过期 + 超限时清理 30% 最旧条目，防止内存泄露
- **新增工具审计** — 15+ 工具的低影响自动审批支持：`task_shell_wait`, `git_status`/`git_diff`/`git_show`/`git_log`/`git_blame`, `handle_read`, `agent_open`/`agent_eval`/`agent_close`, `rlm_open`/`rlm_eval`/`rlm_close`, `run_tests`, `run_verifiers`, `task_create`, `note`

### 修复

- **SSE 事件污染** — 新增 `generation` 机制，会话重置后自动丢弃旧会话的 SSE 事件，防止交叉污染
- **CSP 安全加固** — nonce 改用 `crypto.randomBytes(16)` 生成，替代 `Math.random()`
- **deactivate 清理** — 扩展关闭时正确清理 TUI 进程，避免留下孤儿进程
- **findBinaryFallback 清理** — 移除硬编码的开发者路径依赖，改为统一依赖系统 PATH
- **配置描述更新** — provider 列表、二进制名称等全量更新对齐新版本

### 变更

- **命名统一** — `deepseek-tui` → `codewhale-tui`，全量文档/配置/代码/用户提示更新
- **Provider 凭证迁移** — 旧版全局 API Key 自动迁移到 `deepseek` Provider 命名空间
- **模块级引用** — `extension.ts` 中 `tuiManager` 提至模块级，以便 `deactivate()` 正确访问

---

## 2026-06-02 (v0.1.10)

### 修复

- **审批弹窗**: `autoApprove` 修复 — 不再粘性持久化，新建会话自动重置
- **审批弹窗**: `autoApprove` 仅在 TUI HTTP 调用成功后设置，避免网络失败导致状态不一致
- 新增 `trustActive` 消息通知，用户可感知信任状态的启用和重置

---

## 2026-06-02 (v0.1.9)

### 新增

- typing 指示器改用插件图标 + 脉冲动画，替代圆点 + 文字
- typing 指示器持续显示到回答结束（promptEnded），不再在首段文本到达时消失

### 修复

- MCP 服务器/工具列表响应解析修复（提取 `.servers` / `.tools` 子字段）
- MCP 状态缓存（30s TTL），减少重复请求
- MCP 连接状态显示 + 工具名前缀展示

---

## 2026-05-31 (v0.1.6)

- vsix 插件图标换回透明底，README 保持白底

---

## 2026-05-31 (v0.1.5)

- 图标换为白底版本，暗色背景下可见

---

## 2026-05-31 (v0.1.4)

- 更新插件图标为新版鱼图标 (icon_v100)

---

## 2026-05-31 (v0.1.3)

- 修复插件图标：恢复正确的鱼图标，替换测试用红绿圆图案

---

## 2026-05-31 (v0.1.2)

### 修复

- 停止按钮拆分为 Stop + Cancel，Stop 立即终止生成并取消 pending 工具
- ChatView 滚动修复：自动滚到底 + 用户手动滚动时不抢焦点
- 会话恢复过滤：跳过 interrupted turn，只渲染最终 agent_message
- 多窗口 Session 隔离：每个 VSCode 窗口独立 threadId
- 斜杠命令框架：50+ 命令分 local/api/steer 三类分派
- 设置面板图标更新 + Markdown 渲染修复

### 构建

Extension: 100.0 KB, GUI JS: 278.75 KB, CSS: 38.05 KB

---

## 2026-05-29 (Phase 6.4 封闭测试修复)

### 新增功能 (10 项)

| # | 功能 | 说明 |
|---|------|------|
| 1 | 文件标签 (File Chips) | `@[路径]` 渲染为彩色类型标签，hover 路径，点击打开 |
| 2 | @ 弹窗文件类型图标 | 彩色扩展名图标替代统一 📄 |
| 3 | 粘贴文件路径格式化 | 完整路径→`@[完整路径]`；纯文件名→异步搜索补全 |
| 4 | /help 面板精简 | 57 命令+5 快捷键（移除 TUI UI 专属） |
| 5 | / 弹窗列对齐 | 命令名/中文/描述/分类四列固定宽度 |
| 6 | Session 删除 | TreeView 右键删除（本地隐藏+持久化） |
| 7 | OCR 检测 | 设置面板检测 tesseract，未安装引导下载 |
| 8 | 下载 codewhale | 改名+强制更新(.new 文件绕过占用) |
| 9 | Send 按钮置灰 | 回答期间 Enter 和按钮均不可用 |
| 10 | 低影响工具自动批准 | read_file/list_dir 等不弹审批窗 |

### 问题修复 (26 项)

| # | 问题 | 根因 |
|---|------|------|
| 1 | 顶栏+不能新建session | newSession 不清空聊天/cancel |
| 2 | View Diff 新建文件不显示 | oldContent!==undefined 过滤了 write_file |
| 3 | 审批弹窗卡住 | 两步确认+低影响工具也弹窗 |
| 4 | 面板不自动折叠 | 初始值 true+watch 无 immediate |
| 5 | Sessions 无标题 | CreateThreadRequest 无 title |
| 6 | 点击 session 没反应 | TreeView 命令走 postMessage 被丢弃 |
| 7 | 历史消息不恢复 | TurnRecord 无 prompt 字段 |
| 8 | 复用 thread 重放历史 | streamEvents since_seq=0 |
| 9 | 右侧面板没恢复 | resumeSession 只恢复聊天 |
| 10 | Skills 面板空 | getSkills 在 TUI 未启动时调用 |
| 11 | Context/Usage 不刷新 | 初始化请求在 TUI 启动前发出 |
| 12 | 回答后界面卡"运行中" | SSE 提前关闭 turnCompleted 丢失 |
| 13 | Stop 后工具不停止 | interrupt fire-and-forget |
| 14 | Stop 后 thinking 不消失 | 前端未即时 hideTyping |
| 15 | @undefined | 后端缺 relativePath 字段 |
| 16 | PNG 显示为目录图标 | 路径空格正则截断 |
| 17 | 粘贴文件对象无完整路径 | webview f.path 不可用 |
| 18 | 下载覆盖运行中 exe EPERM | 旧文件被占用 |
| 19 | TUI ANSI 序列刷屏 | stdout ]0;未过滤 |
| 20 | Works 面板 todos 不更新 | toolName 缓存查找失败 |
| 21 | tasks 面板需要 YOLO 模式 | task_create 在 agent 下延迟加载 |
| 22 | agents 面板数量不对 | agentId 提取失败导致去重 |
| 23 | 模型下拉框位置不统一 | 与 mode 分离在两个位置 |
| 24 | 垃圾桶和+功能重复 | 垃圾桶只清空聊天 |
| 25 | sendPrompt 返回后 isProcessing 误重置 | 应在 turnCompleted 重置 |
| 26 | cancel 无 await 导致工具不停 | interrupt 请求未等待 |

### 架构改进

- 模型下拉框移至 ContextBar，顶栏精简为 ⚙🗜＋
- 面板自动折叠：内容空时折叠，有内容展开
- 审批一步操作（移除二次确认）
- Work+Plan 合并，Plan 不再独立面板
- 文件引用统一 `@[路径]` 方括号格式
- interrupt fetch 加 5s 超时，cancel 改为 async
- 请求队列（已回退）→ 改为 Send 按钮置灰

### 构建

Extension: 84.7 KB, GUI JS: 275 KB, CSS: 36 KB

---

---

## 2026-05-24 (Phase 4 完成)

### 审批 UI 重构

- `ApprovalPopup.vue` — 类 TUI 终端 UI：数字键/上下键选择 + Enter 确认 + Esc 返回 + 二次确认
- 工具元数据展示：类型、影响（红/黄/绿编码）、参数（缓存匹配）
- 全中文汉化（标题/按钮/倒计时/确认文案）
- `autoApprove=true` 时自动过滤冗余弹窗

### Bug 修复 (9 项)

| # | 问题 | 根因 | 文件 |
|---|------|------|------|
| 1 | 审批弹窗字段全空 | SSE 外层包装格式 `{payload: {tool_name}}` 未解包 | tuiProcessManager |
| 2 | trust_mode:true 跳过审批 | 硬编码 `trust_mode: true` | tuiProcessManager |
| 3 | 审批参数区始终为空 | item_xxx ≠ call_xxx，ID 匹配失败 | chatViewProvider |
| 4 | View Diff 新旧相同 | git show 失败 fallback 到相同文件 | chatViewProvider |
| 5 | Shell 输出不追加 | toolProgress 缺 itemId，overwrite 而非 append | tuiProcessManager + ChatView |
| 6 | 信任会话不生效 | `_autoApprove` 依赖 TUI HTTP 返回 | tuiProcessManager |
| 7 | 审批 404 报错 | `resp.json()` 空响应体解析失败 | tuiProcessManager |
| 8 | acquireVsCodeApi 重复 | ChatView.vue 重复声明 | ChatView.vue |
| 9 | ResizeObserver null | splitRef 在 tuiReady=false 时为 undefined | App.vue |

### Shell 输出 + Diff

- Shell 输出流式追加：pending 状态追加而非覆盖，`toolProgress` 补传 `itemId`
- View Diff：VS Code diff editor 集成，git show HEAD 获取旧版，edit_file 传 search/replace 预览
- git 不可用时旧侧显示空文件

### Tasks 面板

- `TasksPanel.vue` — 对接 `GET /v1/tasks` API，状态圆点 + 中文标签
- 自动刷新：`toolCompleted`/`turnCompleted` 触发 + prompt 期间 5s 保底轮询
- `/clear` 和 `newSession` 同步清空三个面板
- 空状态统一中文风格（与 Work/Plan 对齐）

### TUI 审批机制调研

- `active_turn_flags` 返回 turn 级别的 `auto_approve`/`trust_mode`（非 thread 级别）
- `remember: true` 调 `remember_thread_auto_approve()` 持久化到 thread record
- turn 创建时 `auto_approve` 从 `thread.auto_approve` 继承

### 构建验证

- Extension: 37.4 KB, GUI JS: 248 KB, CSS: 21.6 KB
- vitest: 11/11 passed

---

## 2026-05-23 (Phase 4 核心)

### Phase 4 — 审批 + 执行

**核心实现：**
- `tuiProcessManager.ts` — `auto_approve` 从硬编码 `true` 改为可配置 `false`，新增 `decideApproval()` 方法
- SSE `approval.required` / `approval.decided` / `approval.timeout` 事件处理
- `ApprovalPopup.vue` — 审批弹窗组件（工具名 + 描述 + 300 秒倒计时）
- 三种决策：Allow / Allow (Session) / Deny，会话级批准后线程自动跳过后续审批
- `chatViewProvider.ts` — `tuiApprovalRequired` / `approvalDecision` 消息路由
- `App.vue` — 审批状态管理 + 弹窗集成

**构建验证：** ext 28.9 KB, gui 247 KB, vitest 11/11 passed

**待完成：** Shell 输出实时流验证、Diff Editor 预览

---

## 2026-05-23 (晚间)

### Help 面板 TUI 完整对齐

- `helpData.ts` 完全重写 — 64 斜杠命令 + 43 快捷键，全部来自 TUI 0.8.40 COMMANDS + KEYBINDINGS
- 命令描述直接翻译自 TUI `localization.rs` 的英文原文
- 每个命令携带全部 TUI 别名（拼音+中文），如 `/help` / `/?` / `/bangzhu` / `/帮助`
- 8 个命令分类 + 7 个快捷键分类，每个分类独立色标
- `/` 弹窗标题修正为 `Commands (64 of 64)`

### Phase 3 总结

| 模块 | 状态 |
|------|:----:|
| @ 提及弹窗 (AtMentionPopup) | ✅ |
| / 命令弹窗 (SlashCommandPopup, 64 cmds) | ✅ |
| Work 面板 (todo_write 解析) | ✅ |
| Plan 面板 (update_plan 解析) | ✅ |
| Help 面板 (64+43 对齐 TUI) | ✅ |
| Sessions TreeView (真实 API) | ✅ |
| 左右分栏 + 拖拽 | ✅ |
| 工具卡片折叠 | ✅ |
| 粘贴图片 | ✅ |
| 右键 @ 加入 | ✅ |
| Cancel interrupt API | ✅ |
| ThreadRecord ISO 8601 | ✅ |

---

## 2026-05-23 (下午)

### Phase 3.2 — Work/Plan 面板数据解析修复

**问题根因:**
- TUI 的 `todo_write` / `update_plan` 工具输出是"文字描述 + JSON"混合格式
- JSON 根键是 `items` 而非 `todos`/`plan`
- 之前的 `JSON.parse` 对整段文字失败，静默返回无数据

**修复:**
- `parseTodoWrite()` / `parseUpdatePlan()` — 用 `indexOf('{')` 提取纯 JSON 再解析
- 同时匹配 `todos`/`items`/`tasks` 和 `plan`/`steps`/`items` 多种键名
- 工具名匹配扩展到 `checklist_write`/`checklist_add`/`checklist_update` 等别名
- 全链路 debug 日志（`[DEBUG] calling parseXxx` → `[Celest] xxx updated: N`）

**验证:**
- Work 面板 ✅ 3 个任务正常显示（状态排序 + 图标 + 删除线）
- Plan 面板 ✅ 3 步计划 + 解释文字正常显示

**构建:** 25.1 KB extension, vitest 11/11 passed

---

# Celest — 开发日志

> 按 git 提交时间线记录。括号内为对应 commit hash。

---

## 2026-05-23

### Phase 3.1 — 7 项问题修复 + Slash/Help 终端对齐 (未提交)

**7 项修复:**

| # | 问题 | 修改文件 | 说明 |
|---|------|---------|------|
| 1 | / 命令光标停在倒数第二字 | InputBox.vue | `handleSlashSelect` 修复 before/after 分割逻辑 |
| 2 | / 命令弹窗滚动不跟随 | SlashCommandPopup.vue | 添加 `watch(selectedIdx)` + `scrollIntoView({ block: 'nearest' })` |
| 3 | 截图粘贴无法作为路径 | InputBox.vue + chatViewProvider.ts + App.vue | paste 检测图片 blob → `pasteImage` → temp 保存 → `@path` 插入 |
| 4 | VS Code 右键不加 @ | extension.ts + chatViewProvider.ts + InputBox.vue + App.vue | `addToChat(uri)` → `addAtMention` → `insertAtCursor('@path ')` |
| 5 | 工具调用卡片默认展开 | ChatView.vue | header 点击切换折叠，折叠时预览结果，`▶/▼` 图标 |
| 6 | 面板 Tab 切换歧义 | App.vue | Tab 布局 → 左右分栏（可拖拽分隔条 + ResizeObserver） |
| 7 | /help 内容与 TUI 不齐 | SlashCommandPopup.vue + helpData.ts + HelpPanel.vue | 60→63 命令 7 分类 A-Z 排序 + 全中文描述 + rowspan 渲染 |

**布局重构:**
- App.vue 从 Tab 切换（Chat/Work/Plan）改为左右分栏
- 左侧 Chat 占 65%，右侧 260px 面板区域
- 拖拽分隔条调整比例，ResizeObserver 监听 VS Code 侧边栏变化
- 右侧面板：Work / Plan / Tasks / Help 纵向堆叠，可折叠

**Help 面板重构:**
- `helpData.ts` — 15 个分类（7 快捷键 + 8 命令组），每个带 `color` 色标
- `HelpPanel.vue` — 独立 Vue 组件，rowspan 渲染别名行，`tbody` 组间分割线，三列固定宽度

**/ 命令面板重构:**
- SlashCommandPopup — 63 个命令，全局 A-Z 排序，每条带 `zhName` 中文名
- 过滤支持中文搜索（zhName + name + description）
- 标题栏显示 `Commands (N of 63)` 计数

**Cancel 机制修复:**
- tuiProcessManager 新增 `_currentThreadId` / `_currentTurnId`
- `cancel()` 先发 `POST .../interrupt`，失败时 fallback `AbortController.abort()`

**ThreadRecord 修复:**
- 返回类型 `ThreadSummary` 匹配 `title` + ISO 8601
- sessionsTreeProvider 用 `title` 显示，fallback `Thread {id[0..8]}`
- `formatDate()` 解析 ISO 8601 → 本地化短日期

**🔧 构建修复:**
- `build.bat` — PATH 改为动态检测 `%AppData%\npm` + `C:\Program Files\nodejs`
- CI 简化 — 去掉 build job，保留 test job（`npx vitest run`）
- 单元测试修复 — tuiProcessManager + sessionsTreeProvider 适配新接口

**文档更新:**
- `PLAN.md` — Phase 3 详细完成清单 + API 兼容性分析 + BUGLOG 索引
- `BUGLOG.md` — Phase 3 新增 3 条问题记录
- `CHANGELOG.md` — 本文件
- `TEST_PLAN.md` — Phase 3 测试策略 + 静态检查项
- `INTEGRATION_TEST.md` — Phase 3 10 章集成测试用例

![image-20260523023820260](C:\Users\59805\AppData\Roaming\Typora\typora-user-images\image-20260523023820260.png)

---

## 2026-05-21

### feat: upgrade protocol ACP→HTTP/SSE (`4cbc31f`)

**改动文件:**
- `src/tuiProcessManager.ts` — 重写为 HTTP/SSE Threads 版本
- `src/protocol.ts` — SSE 事件类型 + Content Union Types
- `src/chatViewProvider.ts` — 按 content 类型分发 tuiText/tuiReasoning/tuiToolCall/tuiToolResult
- `gui/src/App.vue` — SSE 流式消息处理 + 打字机 fallback + Stop
- `gui/src/components/ChatView.vue` — appendText 原地追加 + addToolCall/updateToolResult
- `gui/src/components/ThinkingBlock.vue` — done prop + 实时流状态
- `gui/src/global.css` / `gui/src/main.ts` / `gui/index.html`
- `tmp/test-` — 5 个 HTTP/SSE 调试脚本
- `ARCHITECTURE.md` / `docs/PLAN.md` / `docs/BUGLOG.md`

---

## 2026-05-20

### celest-update — Phase 2 主体 (`4841789`)

ChatView localStorage 持久化 + 打字机 + Thinking 流 + 工具卡片样式 + Stop 按钮 + 自动重试

### docs — 文档骨架 (`6f03c54`)

新增 `docs/BUGLOG.md` `docs/CHANGELOG.md` `docs/PLAN.md`

### fix-test-msg (`e19462f`)

修复 `tuiProcessManager.test.ts` 错误断言

### fix-connection-guard (`ebb0d41`)

`_started` 锁 + `tuiReady` 状态 + "Connecting..." 横幅

### logger — 统一日志 (`e4f8843`)

新增 `src/logger.ts` — 全部模块改用 `[Celest]` 前缀日志

### fix-html-csp (`93086c2`)

读取 Vite 生成的 index.html，动态替换 CSP + 资源路径

### fix-acp-id-string (`9c09b51`)

`jsonRpcClient.ts` 统一 `String(id)` 比较

### fix-error-reporting (`f8f8e0b`)

spawn error + exit 处理改进 + tmp 测试脚本

### fix-build-bat (`1c60a57`)

`build.bat` PATH 检测修复

### build-scripts (`f1f780a`)

新增 `build.bat` `test.bat`

### Phase1.5 — 协议 + RPC (`c0fe932`)

protocol.ts + jsonRpcClient.ts + tuiProcessManager + chatViewProvider 骨架

### Phase1 — 项目初始化 (`a9acb54`)

25+ 文件：Vue 3 GUI + 6 组件 + build + vitest + CI + 文档

### Phase0 — Git 初始化 (`061a256`)

---

## 构建历史

| 日期 | Commit | 说明 |
|------|--------|------|
| 05-23 | (未提交) | Phase 3.1 — 7 fixes + Slash/Help/Sessions/Cancel |
| 05-21 | `4cbc31f` | HTTP/SSE 协议升级 |
| 05-20 | `4841789` | Phase 2 主体 |
| 05-20 | 多个 | Phase 1 ~ Phase 2 各种修复 |
