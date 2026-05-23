# Celest — 问题解决记录

> 记录开发过程中遇到的问题、根因、解决方案，避免踩同样的坑。

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
