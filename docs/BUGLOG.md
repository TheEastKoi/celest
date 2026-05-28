# Celest — 问题解决记录

## 粘贴文件对象无法获取完整路径 (2026-05-29) ⭐

**现象:** 从 Windows 资源管理器复制文件粘贴到 Celest 输入框，只显示文件名而非完整路径。
**根因:** VS Code webview 沙箱限制 `cd.files[0].path` 不可用，`cd.types` 只有 `Files`（无 `text/plain`/`text/uri-list`）。
**修复:** 粘贴纯文件名时先插入 `@[文件名]`，emit 事件到后端用 `vscode.workspace.findFiles` 异步搜索完整路径后替换。`Ctrl+Shift+L` 走扩展 API 可获取完整路径。
**文件:** `InputBox.vue`、`chatViewProvider.ts`、`App.vue`

---

## 复用 thread 导致历史消息重放 (2026-05-29) ⭐

**现象:** 同一 thread 中发第二条消息时，聊天区瞬间输出全部历史消息，thinking 块丢失。
**根因:** `streamEvents()` 始终使用 `since_seq=0`，复用 thread 时 TUI 从第一个事件开始重放。
**修复:** 维护 `_lastEventSeq` 跟踪事件序列号，复用 thread 时在 `sendPrompt` 前通过 `getThreadDetail` 获取 `latest_seq`，`since_seq=latest_seq+1` 只读增量事件。
**文件:** `tuiProcessManager.ts`

---

## 下载二进制覆盖运行中进程报 EPERM (2026-05-29)

**现象:** 点击"下载 codewhale"报 `EPERM: operation not permitted, unlink`
**根因:** 旧 `codewhale-tui.exe` 正在运行，无法删除。
**修复:** 强制下载保存到 `.new` 文件，更新 `binaryPath` 指向新文件，下次启动自动使用。
**文件:** `binaryDownloader.ts`

---

## Stop 后工具未停止且卡片 pending (2026-05-29) ⭐

**现象:** 点 Stop 后工具卡片仍显示 pending，TUI 端工具继续执行。
**根因:** `cancel()` 是 fire-and-forget，interrupt 请求未 await；SSE 流 abort 后 TUI 的 `item.failed` 事件无法到达。
**修复:** `cancel()` 改为 async + 5s 超时；前端 `cancelPendingTools()` 将所有 pending 工具标记为 error；`handleStop` 即时 `hideTyping()`。
**文件:** `tuiProcessManager.ts`、`ChatView.vue`、`App.vue`

---

## 回答完成界面仍显示"运行中" (2026-05-29)

**现象:** AI 回答完成后 Stop 按钮仍亮着，typing 指示器不消失。
**根因:** SSE 流可能提前关闭导致 `turnCompleted` 事件丢失，前端 `promptRunning` 永不重置。
**修复:** `sendPrompt` 成功后兜底发送 `promptEnded`。
**文件:** `chatViewProvider.ts`

---

## 审批 Allow 后弹窗不消失导致界面卡死 (2026-05-28) ⭐

**现象:** Agent 模式下 write_file 弹窗，选择 1（允许本次），二次确认后弹窗显示 ✓ 但不消失，后续界面卡死。
**根因:** `chatViewProvider` `case 'approvalDecision'` 在调用 `decideApproval` 后等待 SSE `approval.decided` 事件回传来关闭弹窗。但 SSE 事件可能在弹窗关闭后才到达，或由于网络/时序问题丢失，导致 `showApproval = false` 永远不会触发。
**修复:** 在调用 `decideApproval` **之前**立即 `postMessage({ type: 'tuiApprovalDecided' })` 关闭弹窗。审批 API 仍然异步调用，但不阻塞 UI。
**文件:** `src/chatViewProvider.ts`

---

## View Diff 按钮无反应 (2026-05-28)

**现象:** 点击 "View Diff" 按钮没有打开 VS Code diff editor。
**根因:** `showDiff` 方法使用 `vscode.Uri.parse('celest-diff:...')` 自定义 scheme URI 作为旧版文件，但没有注册对应的 `TextDocumentContentProvider`，VS Code 无法读取内容。
**修复:** 改用临时文件方案——将 oldContent 和 newContent 分别写入 `globalStorage/diffs/` 目录下的临时文件，再用 `vscode.Uri.file()` 创建 URI。
**文件:** `src/chatViewProvider.ts:showDiff()`

---

## Markdown 表格无分割线 (2026-05-28)

**现象:** Agent 回复中的 Markdown 表格无边框和分割线。
**根因:** `global.css` 中没有 table/th/td 样式。
**修复:** 添加 `border-collapse: collapse` + `th/td { border: 1px solid }` 样式。
**文件:** `gui/src/global.css`

---

## ContextPanel 标题颜色误导为可点击链接 (2026-05-28)

**现象:** "用量""工作区""MCP" 等分组标题使用蓝色 (`--vscode-textLink-foreground`)，用户尝试点击无效。
**根因:** VS Code 主题变量 `textLink-foreground` 是链接专用色，应用于纯静态标签会造成误导。
**修复:** 改为 `var(--vscode-foreground); opacity: 0.6` 灰色标签色。
**文件:** `gui/src/components/ContextPanel.vue`

---

## UsagePanel acquireVsCodeApi 重复调用 (2026-05-27)

**现象:** Usage 面板始终为空，永远显示 "No usage data available"。
**根因:** `UsagePanel.vue` 中声明了独立的 `declare function acquireVsCodeApi()`，在 VS Code WebView 中第二次调用返回 undefined，`vscode.postMessage` 静默失败。
**修复:** 改为 props-driven 组件，由 App.vue 统一管理数据流。
**文件:** `gui/src/components/UsagePanel.vue`, `gui/src/App.vue`

---

## SSE 审批事件字段全部为空 (2026-05-24) ⭐

**现象:** 审批弹窗只显示扳手图标，工具名和描述为空；`approvalId` 也为空 → Deny/Allow 报 404。
**根因:** TUI `/v1/threads/{id}/events` 端点返回的 SSE data 是外层包装格式：
```json
{"seq":..., "thread_id":..., "payload": {"tool_name":"exec_shell", "description":"..."}}
```
而 `dispatchRawEvent` 中三个审批处理器直接读顶层字段 `payload.tool_name` → `undefined` → 空字符串。
**修复:** 先解包 `inner = payload.payload || payload`，再从 `inner` 取字段。同时修复 `approval.required`、`approval.decided`、`approval.timeout` 三个处理器。注意 `item.*` 事件已有 `const p = payload.payload || {}` 逻辑，不受影响。

---

## trust_mode: true 导致审批被跳过 (2026-05-24)

**现象:** 输入"列出当前目录文件"后没有审批弹窗弹出。
**根因:** `sendPrompt` 中 `trust_mode: true` 硬编码，在 TUI 中 `trust_mode` 会跳过所有审批检查（`if auto_approve || trust_mode`）。
**修复:** 改为 `trust_mode: false`，由审批流程控制。用户通过"信任会话"按钮提升为 `auto_approve: true`。

---

## 审批 ID 与 item ID 不匹配导致缓存失效 (2026-05-24)

**现象:** 审批弹窗参数区始终为空。
**根因:** TUI 中 tool_call 的 TurnItem id (`item_xxx`) ≠ engine call id (`call_xxx`)。`_toolCache` 按 `item.id` 存储，`approval.id` 查找时永远 MISS。
**修复:** 改为按工具名遍历匹配缓存（同一 turn 内只有一个待审批工具），不再依赖 ID 精确匹配。

---

## View Diff 新旧文件相同 (2026-05-24)

**现象:** 点击 View Diff 后 diff editor 显示两侧内容完全一样。
**根因:** `git show HEAD:path` 失败时 `oldUri = newUri`，指向同一个文件。
**修复:** git 失败时旧侧显示空文件，至少能看出差异。新旧内容都写入临时文件避免锁定。`edit_file` 前端传 search/replace 作为 old/new 预览。

---

## Phase 4 设计决策：auto_approve 开关 (2026-05-23)

**背景:** 审批流程中用户可能希望一键批准当前会话的所有后续工具调用。

**决策:** `tuiProcessManager.autoApprove` 暴露为 getter/setter。当用户在审批弹窗中选择 "Allow (Session)"（`remember: true`）时：
1. celest 发送 `POST /v1/approvals/{id}` 带 `{ decision: "allow", remember: true }`
2. TUI 内部调用 `remember_thread_auto_approve()` 标记该线程
3. celest 同步 `this._autoApprove = true`，后续新 thread 创建时 `auto_approve: true`

**关键点:** `remember` 是会话级别的——同一 thread 的后续工具调用自动批准。新建 thread 时如果 `_autoApprove` 已设 true 也会自动批准。

---

---

## Tasks 面板轮询在 turn 结束后不停止 (2026-05-24)

**现象:** Tasks 面板数据一直显示旧任务，turn 结束后状态不再更新。
**根因:** 只在 `toolCompleted` 时刷新，但后台任务状态变化不产生 tool call 事件。
**修复:** 新增 `startTaskPolling()`/`stopTaskPolling()`，prompt 开始时启动 3→5s 轮询，`turnCompleted` 时停止。

---

## 审批弹窗冗余 (2026-05-24)

**现象:** 点"信任会话"后，后续工具仍然弹窗但审批已自动通过（弹窗形同虚设）。
**根因:** TUI 在 `auto_approve=true` 时仍发送 `approval.required` 事件（只是瞬间自动批准）。
**修复:** `chatViewProvider.onApprovalRequired` 中检查 `tuiManager.autoApprove`，为 `true` 时跳过弹窗。

---

## Vue 模板注释语法错误 (2026-05-23)

**现象:** `vite build` 报错 `Error parsing JavaScript expression: Unexpected token`
**根因:** `ApprovalPopup.vue` 模板中 `@click.self="/* ignore backdrop click */"` 使用了 JS 块注释 `/* */`。Vue 模板编译器在解析属性表达式时不支持块注释。
**修复:** 移除注释，Vue SFC 模板属性应使用无操作或空字符串，注释放在 `<script>` 中。

---

## ACP JSON-RPC ID 类型不匹配

**时间:** 2026-05-20  
**现象:** `ACP handshake timeout` — TUI 进程启动成功，但 initialize 请求无响应。  
**根因:** ACP 协议返回的 `"id"` 字段是字符串 `"1"`，但请求发送的是数字 `1`。JavaScript `Map.get()` 使用 `===` 严格比较，`1 !== "1"`，永远匹配不到响应。  
**修复:** `jsonRpcClient.ts` 中统一使用 `String(id)` 归一化 ID。  
**参考:** commit `fix-acp-id-string`

---

## 构建脚本 npm 找不到

**时间:** 2026-05-20  
**现象:** 直接运行 `npm install` 报 `'npm' is not recognized`。  
**根因:** Windows 系统 PATH 不包含 `D:\nodejs`。  
**修复:** 创建 `build.bat`，开头 `set PATH=D:\nodejs;%PATH%`，使用完整路径 `D:\nodejs\npm.cmd`。  
**参考:** commit `build-scripts`

---

## build.bat 中管道干扰 exit code

**时间:** 2026-05-20  
**现象:** `build.bat` 中 `npm install` 通过管道 `| findstr` 过滤后，`%ERRORLEVEL%` 始终为 0，无法检测 npm 失败。  
**根因:** Windows cmd 中管道最后一个命令决定 ERRORLEVEL，`findstr` 成功返回 0 覆盖了 npm 的退出码。  
**修复:** 去掉管道，让 npm 直接输出，用 `%ERRORLEVEL%` 检查。  
**参考:** commit `fix-build-bat`

---

## Vue GUI 资源 404

**时间:** 2026-05-20  
**现象:** Developer Tools Console 中 `Failed to load resource: 404`，CSS/JS 加载失败。  
**根因:** 手写 HTML 硬编码 `index.js` / `index.css` 路径，CSP 配置不正确。Vite 构建可能产生 chunk 分片文件名。  
**修复:** 改为读取 Vite 生成的 `out/gui/index.html`，用正则替换 `./assets/*` 为 `vscode-resource://` URI，自动注入 CSP。  
**参考:** commit `fix-html-csp`

---

## sendPrompt 在 TUI 未就绪时被调用

**时间:** 2026-05-20  
**现象:** `TUI not connected` 错误 — 用户发送消息时 TUI 进程尚未完成握手。  
**根因:** `activate()` 中 `start()` 是异步的，GUI 的 `ready` 消息可能在 `start()` 完成前到达，导致 `_sessionId` 为 undefined。  
**修复:** 新增 `_started` 布尔锁，`sendPrompt` 检查 `_started`。前端新增 `tuiReady` 状态，未就绪时禁用输入框并显示 "Connecting..."。  
**参考:** commit `fix-connection-guard`

---

## 测试用例文案和代码不一致

**时间:** 2026-05-20  
**现象:** 测试失败 — `expected 'not connected' but got 'TUI not yet connected'`。  
**根因:** 修改了错误消息文案但忘记同步更新测试用例。  
**修复:** 更新测试文件中的 `toThrow` 期望值。  
**参考:** commit `fix-test-msg`

---

## TUI ACP 不发送 reasoning/thinking 内容

**时间:** 2026-05-20  
**现象:** 无论发送多复杂的 prompt，前端从不出现 🧠 Thinking 折叠块。  
**根因:** `deepseek-tui` 的 ACP 协议实现中，`session/update` 通知的 `content.type` 恒为 `"text"`。  
**修复:** 放弃 ACP stdio 协议，改用 HTTP/SSE 运行时 API：
1. 启动 `deepseek-tui serve --http --insecure`（而非 `--acp`）
2. 用 `POST /v1/threads` + `POST /v1/threads/{id}/turns` 发送 prompt
3. 用 `GET /v1/threads/{id}/events` 订阅原始运行时事件流
4. 原生事件包含 `item.delta` with `kind=agent_reasoning`，逐字流式推送 thinking 内容
5. **零修改 TUI 源码**  
**状态:** ✅ 已解决 (2026-05-21, commit `protocol-http-sse`)

---

## 协议升级：ACP → HTTP/SSE

**时间:** 2026-05-21  
**现象:** ACP 协议不支持真正的流式传输（非流式 API 调用 + 人工分块模拟），且缺少 reasoning/tool 事件。  
**根因:** ACP 是为编辑器 stdio 集成设计的轻量协议，功能受限。`deepseek-tui` 另有完整的 HTTP Runtime API（`serve --http`），支持 SSE 流式 + 工具执行 + reasoning。  
**修复:** 全面重写 `tuiProcessManager.ts` 和 `chatViewProvider.ts`：
- spawn 命令：`serve --acp` → `serve --http --port PORT --insecure`
- 通信方式：JSON-RPC over stdio → HTTP fetch + SSE
- 事件源：`session/update` 通知 → 原生 `item.delta`/`item.started`/`item.completed` 事件
- 工具名：`event.kind`（`"tool_call"`）→ `payload.tool.name`（`"web_search"`）  
**参考:** `src/tuiProcessManager.ts`, `src/chatViewProvider.ts`

---

## `--cors-origin '*'` 导致 TUI HTTP 启动失败

**时间:** 2026-05-21  
**现象:** `TUI HTTP server did not start within 30s on port 7878` — TUI 进程静默退出。  
**根因:** `deepseek-tui serve --http --cors-origin '*'` 中 `*` 不是合法 URL，TUI 参数解析失败后进程直接退出，但 stdout/stderr 无明确错误（`--cors-origin` 期望 URL 如 `http://localhost:5173`）。  
**修复:** 改为 `--insecure` 标志（禁用 API 认证），无需 CORS 特殊配置即可本地访问。同时在 `waitForReady()` 中增加进程退出检测（`exitCode !== null`），立即失败而非等 30 秒。  
**参考:** `src/tuiProcessManager.ts:126`

---

## Vite 构建 HTML 内联 CSS 报错

**时间:** 2026-05-21  
**现象:** `vite build` 失败：`Could not load ...index.html?html-proxy&inline-css&index=0.css - No matching HTML proxy module found`。  
**根因:** Vite 5 的 HTML inline proxy 对 `<style>` 标签的处理在某些配置组合下不稳定（`rollupOptions.input` 可能冲突）。  
**修复:** 将 `index.html` 中的内联 `<style>` 移到独立 `src/global.css`，由 `main.ts` import 加载。  
**参考:** `gui/index.html`, `gui/src/global.css`, `gui/src/main.ts`

---

## `POST /v1/stream` 缺少 reasoning 事件

**时间:** 2026-05-21  
**现象:** Thinking 块不显示 — 用 `POST /v1/stream` 兼容端点，SSE 事件只有 `message.delta` 和 `tool.*`，无 reasoning。  
**根因:** `POST /v1/stream` 经过 `map_compat_stream_event()` 转换，该函数只映射了 `agent_message` 和 `tool_call` 的 `item.delta`，丢弃了 `agent_reasoning`。  
**修复:** 改用原生线程事件流 — 先 `POST /v1/threads` 创建线程，再 `GET /v1/threads/{id}/events` 订阅原始事件。原生事件流完整包含 `kind=agent_reasoning` 的 `item.delta` 事件，实现真正的 thinking 流式。  
**参考:** `src/tuiProcessManager.ts:streamEvents()`

---

## 工具卡片显示为原始文本（`tool_call success {...} Result:`）

**时间:** 2026-05-21  
**现象:** 工具调用结果被渲染为原始 Markdown 文本（含 `🔧 tool_call success {JSON} Result:`），而非工具卡片。  
**根因:** `toolStarted` 事件中的工具名取的是 `event.kind`（值为 `"tool_call"` 或 `"command_execution"`），而非实际工具名（如 `"web_search"`、`"exec_shell"`）。前端 `addToolCard` 用工具名作为 key，`"tool_call"` 无法匹配工具结果中的 `callId`，结果被当作普通文本追加。  
**修复:** 从 `payload.tool.name` 提取真实工具名，存入 `RuntimeEvent.toolName`。同时修正 `toolCompleted` status 判断（`item.failed` → error，`item.completed` → success），新增 `toolFailed` 事件类型。  
**参考:** `src/tuiProcessManager.ts:dispatchRawEvent()`, `src/chatViewProvider.ts:toolStarted/toolCompleted`

---

## / 命令选中后出现双 `//`

**时间:** 2026-05-23  
**现象:** 在输入框输入 `/help`，回车后变为 `//help`。  
**根因:** `handleSlashSelect` 使用 `insertAtCursor('/' + cmd.name)`，但 `before` 已含 `/`。  
**修复:** 用 `lastIndexOf('/', cursor)` 精确定位 `/` 开始位置，`before = text.slice(0, slashPos)`，精确替换。  
**参考:** `InputBox.vue:handleSlashSelect`

---

## / 命令弹窗滚动条不跟随

**时间:** 2026-05-23  
**现象:** 键盘 ↓ 选择到底部命令时滚动条不跟随。  
**根因:** 弹窗没有主动 `scrollIntoView`。  
**修复:** AtMentionPopup + SlashCommandPopup 添加 `watch(selectedIdx)` + `scrollIntoView({ block: 'nearest' })`。  
**参考:** `AtMentionPopup.vue`, `SlashCommandPopup.vue`

---

## 截图粘贴无法获得文件路径

**时间:** 2026-05-23  
**现象:** Windows 截图粘贴到对话框无法获得路径。  
**根因:** 剪贴板图片是 blob，WebView 无法获取本地路径。  
**修复:** InputBox 检测 blob → `pasteImage` 消息 → chatViewProvider 保存到 temp → `pasteImageResult` → 替换占位为 @path。  
**参考:** `InputBox.vue:handlePaste`, `chatViewProvider.ts`

---

## 首屏加载左右分栏空白

**时间:** 2026-05-23  
**现象:** 插件首次激活时左侧空白，需拖拽分隔条才渲染。  
**根因:** `initSplitWidth()` 调用时 DOM 未完成 layout，`clientWidth = 0`。  
**修复:** `nextTick()` 包裹 + `ResizeObserver` 持续监听 + 比例改为百分比（65%/35%）。  
**参考:** `App.vue:initSplitWidth`

## Work/Plan 面板数据解析失败 — TUI 混合文本+JSON 输出

**时间:** 2026-05-23 下午
**现象:** 发送 prompt 触发 `todo_write` 后，Console 日志显示 `toolName: todo_write` 但没有 `todos updated` 日志，Work 面板为空。
**根因:** 
1. TUI 工具输出格式为"文字描述 + JSON"（如 `"Todo list updated (3 items)\n{\"items\": [...]}"`），`JSON.parse` 对整段文字失败
2. JSON 根键是 `items` 而非预期的 `todos`
**修复:** 
1. `parseTodoWrite` / `parseUpdatePlan` — 用 `indexOf('{')` 提取纯 JSON 子串再解析
2. 同时检查 `todos`/`items`/`tasks` 和 `plan`/`steps`/`items` 多种键名
3. 工具名匹配扩展到 `checklist_write` 系列别名
**参考:** `App.vue:parseTodoWrite`, `App.vue:parseUpdatePlan`