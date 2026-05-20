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
**根因:** `deepseek-tui` 的 ACP 协议实现中，`session/update` 通知的 `content.type` 恒为 `"text"`。thinking/reasoning 内容在 TUI 内部被剥离，不通过 ACP 传给客户端。日志确认：
```
notification: agent_message_chunk, content={"type":"text","text":"..."}
```
从未出现 `type="reasoning"` 或 `type="thinking"`。  
**影响:** Thinking block 功能无法在当前 TUI 版本上实现。  
**修复方向:** 需要修改 `deepseek-tui` Rust 源码（`crates/acp` 或 `crates/app-server`），在生成 thinking token 时发送 `content.type="reasoning"` 的 `session/update` 通知。  
**状态:** 🔴 Blocked（需 TUI 端配合）

---

## 待解决的问题

- Thinking block 功能 blocked（见上）
