# Celest v0.2.0 更新计划

> 更新日期: 2026-06-16
> 目标: 对齐 CodeWhale TUI v0.8.61，修复已知 Bug，改善国内网络安装体验

---

## 目录

1. [Bug 修复](#1-bug-修复)
2. [Phase 1 — 二进制下载器重构](#2-phase-1--二进制下载器重构)
3. [Phase 2 — Provider 生态同步](#3-phase-2--provider-生态同步)
4. [Phase 3 — TUI API/协议对齐](#4-phase-3--tui-api协议对齐)
5. [Phase 4 — GUI 前端升级](#5-phase-4--gui-前端升级)
6. [Phase 5 — 配置管理增强](#6-phase-5--配置管理增强)
7. [Phase 6 — 上下文管理优化](#7-phase-6--上下文管理优化)
8. [发布计划](#8-发布计划)
9. [关键风险](#9-关键风险)

---

## 1. Bug 修复

### Bug 1: `/` 斜杠命令识别不全

**症状：** CodeWhale 支持大量斜杠命令（`/restore`, `/undo`, `/voice`, `/goal`, `/swarm`, `/hunt`, `/jobs`, `/provider`, `/model` 等），但 celest 的 `dispatchSlashCommand()` 只实现了其中一小部分，未处理的命令走 fallthrough 后以普通 prompt 发送给 TUI，TUI 的 HTTP API 端不会将其解释为内部命令，导致无法正常执行。

**根因分析：**

在 `chatViewProvider.ts` 第 605 行：
```typescript
const slashMatch = prompt.match(/^\/(\S+)(?:\s+(.*))?$/);
if (slashMatch) {
    // ... 调 dispatchSlashCommand
    if (result !== null) {
        // 本地处理成功 → break
        break;
    }
    // result === null → 不 break，fallthrough 到 sendPrompt
}
// 这里会把整个 prompt（含 /command）当作普通消息发送
```

`dispatchSlashCommand()` 的 `default` case 返回 `null`（第 1272-1273 行），导致未知命令 fallthrough 到 `sendPrompt()`，但 TUI 的 HTTP API 不会像 TUI 终端一样解析斜杠命令。

**修复方案：**

**方案 A（推荐）** — 将所有 CodeWhale 支持的斜杠命令添加到 `dispatchSlashCommand` 中：
- 新增命令：`/restore`, `/undo`, `/voice`, `/voice-send`, `/voice-control`, `/goal`, `/goal pause/resume/complete/blocked/clear`, `/hunt`, `/swarm`, `/jobs`, `/jobs cancel-all`, `/subagents`, `/statusline`, `/config`, `/skills`, `/skill install`, `/provider`, `/provider fallback reset`, `/model`, `/compact`, `/change`, `/cost`, `/doctor`, `/auth`
- 这些命令通过 HTTP API 调用 CodeWhale TUI 的对应端点

**方案 B** — 将未知 `/` 命令通过 `POST /v1/threads/{id}/steer` 发送给 TUI 引擎处理：
```typescript
default:
    // 作为 steer 命令发送给 TUI 引擎处理
    await this.tuiManager.steerTurn(threadId, turnId, prompt);
    return null; // 等待 SSE 事件
```

**实现细节：**
- 需要 `tuiProcessManager.ts` 新增 `executeSlashCommand(cmd, args)` 方法
- 参考 CodeWhale 源码 `commands/registry.rs` 中的完整命令列表
- 命令分类：本地 UI 命令（`/clear`, `/help`）在前端 GUI 拦截，TUI 命令走 HTTP API

---

### Bug 2: `@[...]` 文件引用与输入冲突

**症状：** 用户输入中包含 `@` 字符（如 `@model`, `@config`，或粘贴 `C:\path` 路径）时，GUI 端的 `@` 自动补全、路径格式化和扩展端 `enrichPromptWithFiles()` 三方逻辑相互干扰，导致：
1. 输入 `@` 时弹出文件选择弹窗（不期望时）
2. 粘贴包含 `@` 的文本被错误识别为文件路径
3. GUI 的 `@` 正则替换（`App.vue` 第 237 行）与后端 `enrichPromptWithFiles` 双重处理可能产生冲突

**根因分析：**

**GUI 端**（`App.vue:237`）：
```typescript
text = text.replace(/@([^\s\[]\S*(?:\s+\S+)+)/g, (_m, p) => `@[${p}]`);
```
这个正则无条件将 `@xxx yyy` => `@[xxx yyy]`，即使后面没有 `@[...]` 匹配的文件也会执行。

**GUI 端**（`InputBox.vue:187-193`）：
```typescript
const atMatch = before.match(/@(\S*)$/);
if (atMatch && !showSlashPopup.value) {
    // 弹出 @ 文件选择弹窗
}
```
输入 `@` 就会弹出文件选择，无法输入 `@xxx` 作为普通文本。

**扩展端**（`chatViewProvider.ts:1355-1387`）：
```typescript
const re = /@\[([^\]]+)\]/g;
// 尝试读取匹配的路径作为文件内容
```
即使 `@[...]` 中的内容不是有效文件路径，也只是静默跳过，不会报错提示用户。

**修复方案：**

1. **GUI 端 `@` 弹窗限制**（`InputBox.vue`）：
   - 只在用户输入 `@` 后 `N` 毫秒内继续输入时触发弹窗（debounce）
   - 或只在 `@` 后接字母的特定上下文触发（不触发 `/` 后的 `@`）

2. **GUI 端自动 `@[...]` 包装限制**（`App.vue:237`）：
   - 仅当后面的文本看起来确实像文件路径时才包装
   - 正则改为 `@([^\s\[]\S*\.\w{1,8}(?:\s+\S+\.\w{1,8})*)`（必须包含扩展名）

3. **扩展端 `enrichPromptWithFiles` 改进**（`chatViewProvider.ts`）：
   - 当 `@[...]` 中的路径不存在时，返回明确提示而非静默忽略
   - 增加文件不存在时的用户反馈

4. **粘贴处理优化**（`InputBox.vue:207-234`）：
   - `isFilePath` 增加 `file://` 协议检测
   - 当用户有选区时，不要自动格式化粘贴内容（只插入原始文本）

---

### Bug 3: 多轮对话后 AI 降智（上下文拥堵）

**症状：** 多轮对话后，AI 回复质量明显下降（"懈怠"、"降智"），表现为：
1. 回复变短、缺乏深度
2. 工具调用减少
3. 推理链变浅
4. 忘记上下文中的关键细节

**根因分析：**

这是 CodeWhale TUI 引擎层面和 celest 层面共同的问题：

**TUI 引擎层面** — CodeWhale TUI 的线程模型是 append-only：每个新 turn 追加到上下文后面，随着 turn 数增加：
- 上下文窗口占用率上升（1M token 窗口）
- 高上下文占用下模型注意力分散
- 未触发自动压缩 / compaction

**celest 层面** — 当前只有手动 `/compact` 命令，缺乏：
1. 上下文占用率监控和自动告警
2. 达到阈值时自动触发 compaction
3. 上下文窗口使用率的可视化面板
4. `enrichPromptWithFiles` 注入的 @[文件] 内容单次最多 3000 字符，但累积后显著增加上下文体积
5. 每轮注入的 `[系统提示: 预计运行超过10秒...]` 提示重复累积

**修复方案：**

1. **自动上下文监控**（`tuiProcessManager.ts`）：
   - 每 N 轮对话后自动检查 `GET /v1/runtime/info` 或 `GET /v1/usage` 中的 token 使用量
   - 当上下文占用 >70% 时，在状态栏显示警告
   - 当上下文占用 >85% 时，自动触发 `/compact`（或提示用户）

2. **智能 compaction 策略**：
   - 不仅靠 `/compact`，还可在发新 prompt 前检测上下文大小
   - 如果上下文过大，自动在 prompt 前添加 compaction 请求
   - 参考 CodeWhale 的 auto-compact 实现

3. **GUI 上下文面板**：
   - 在 ContextBar 或新面板中显示当前上下文 token 使用量
   - 显示使用率进度条（如: `████████░░ 78%`）

4. **减少冗余注入**：
   - `enrichPromptWithFiles` 已在 prompt 中注入文件内容，这些累积后很可观
   - 只在用户明确引用时注入，去掉每轮不必要的重复系统提示
   - 将 `[系统提示: 预计运行超过10秒...]` 改为只在首轮注入，或通过 TUI 配置注入而非每轮添加

5. **遵循 CodeWhale 的上下文管理机制**：
   - CodeWhale v0.8.57+ 有更完善的上下文管理（系统休眠恢复、compaction 规划器等）
   - 对齐这些新机制

---

### Bug 4: Mode/WhaleFlow 模式感知弱，工作流可视化不足

**症状：** 用户在工作过程中观察到：
1. **工作流（workflow）调用居多** — AI 在 Agent 模式下持续执行多步工具调用，看起来像在跑"工作流"
2. **Plan/Agent 模式切换不频繁** — 用户不知道或不记得可以切换模式
3. **缺少模式感知反馈** — 当前模式（Plan/Agent/YOLO）缺乏足够醒目的视觉提示

**先分析 celest 已实现的右侧面板（用户指出已有）：**

| 面板 | 组件 | 已实现内容 | 状态 |
|------|------|-----------|------|
| 📋 Work | `WorkPanel.vue` | checklist_write 的任务 + update_plan 的计划步骤 | ✅ |
| 📌 Tasks | `TasksPanel.vue` | task_create 的后台任务（状态点+标题） | ✅ |
| 🤖 Agents | `AgentsPanel.vue` | agent_open 的子代理（id/状态/prompt/result） | ✅ |
| 🧩 Skills | `SkillsPanel.vue` | 技能列表（启用/禁用切换） | ✅ |
| 🔍 Context | `ContextPanel.vue` | token 用量/Git 状态/MCP 服务器数 | ✅ |
| 📈 Usage | `UsagePanel.vue` | 费用/用量统计 | ✅ |
| ⚙ Mode | `ContextBar.vue` | 显示当前模式 + 点击循环切换 | ✅ |

**真正缺失的东西：**

1. **Mode 指示器不够醒目** — 当前 mode 只在 ContextBar（底栏）显示为 `⚙ Agent`，和模型选择器、Git 分支混在一起。原生 CodeWhale TUI 在 footer 有独立颜色 badge。用户工作时不容易注意到。

2. **WhaleFlow 工作流面板缺失** — CodeWhale v0.8.60+ 的 WhaleFlow（`.workflow.js`）是一个独立的声明式工作流引擎，有专用的 progress view、worker 状态、并行节点进度图。celest 完全没有对应的 UI 组件。

3. **子 Agent 细节不足** — `AgentsPanel.vue` 只显示了 id/status/prompt/result，缺少 CodeWhale v0.8.61 新增的 role（review/verifier/implementer）、model 路由信息、运行时长。

4. **Goal 目标面板缺失** — CodeWhale v0.8.59+ 的 `/goal` 系统有目标进度、token/time 会计、验证器表决。celest 完全没有。

5. **没有 Mode 建议/引导** — 用户一直在 Agent 模式下工作，不知道 Plan 模式可以用于只读设计探索，也不知道 YOLO 模式可以跳过审批。

6. **WhaleFlow 的 `workflow.*` SSE 事件未对接** — chatViewProvider.ts 中没有处理 workflow 相关的事件。

**根因判断：** 这是 **celest 侧的问题**。CodeWhale 原生 TUI 的 mode/WhaleFlow UI 完善，但 celest 的 WebView 没有对齐这些可视化能力。

**修复方案：**

1. **Mode Badge 增强**（`gui/src/components/ContextBar.vue` + `App.vue`）：
   - 在聊天区域顶部增加独立模式大 badge：🟢 **Agent** / 🔵 **Plan** / 🔴 **YOLO**
   - badge 可点击切换模式（不用到底部 ContextBar 找）
   - 每个 mode 的 tool 可用性摘要

2. **WhaleFlow 工作流面板**（新增 `gui/src/components/WorkflowPanel.vue`）：
   - 监听 `workflow.*` SSE 事件
   - 显示运行中的工作流、当前节点进度、并行 branch/seq 状态
   - 在右侧面板新增 🐋 Workflows 区

3. **AgentsPanel 增强**（`AgentsPanel.vue`）：
   - 新增 role 显示（review/verifier/implementer）
   - 新增 model 显示（每个子 agent 路由的模型）
   - 新增运行时长

4. **Goal 面板**（新增 `gui/src/components/GoalPanel.vue`）：
   - 显示当前目标、进度、token 消耗
   - pause/resume/complete/blocked/clear 控制

5. **输入框 mode 感知**（`InputBox.vue`）：
   - placeholder 随 mode 变化，提示当前模式限制
   - 例如 Plan 模式显示：`探索和设计...(只读模式，无 shell) [Plan]`

6. **首轮 mode 引导提示**（`chatViewProvider.ts`）：
   - 根据当前 mode 注入引导系统提示到首轮对话
   - 告知用户当前模式的限制和用法

7. **Mode 主动建议**：
   - 当用户输入"这个项目是做什么的"等探索性问题，建议切换到 Plan
   - 当用户说"帮我改代码"，建议切换到 Agent

**涉及文件：**
- `gui/src/App.vue` — 顶部 mode badge、WorkflowPanel/GoalPanel 集成
- `gui/src/components/ContextBar.vue` — mode 显示强化
- `gui/src/components/AgentsPanel.vue` — role/model/时长增强
- `gui/src/components/WorkflowPanel.vue` — **新增**
- `gui/src/components/GoalPanel.vue` — **新增**
- `gui/src/components/InputBox.vue` — mode 感知 placeholder
- `src/chatViewProvider.ts` — workflow SSE 事件处理、mode 引导提示
- `src/tuiProcessManager.ts` — workflow/goal API 调用
- `src/protocol.ts` — workflow/goal 类型定义

**优先级：P1（高）** — 直接影响用户体验感知

---

### Bug 5: 斜杠命令 fallthrough 导致未知命令以普通 prompt 发送

**症状：** 用户在输入 `/restore`, `/undo`, `/voice`, `/goal`, `/hunt`, `/swarm`, `/jobs`, `/auth` 等未在 `dispatchSlashCommand` 中注册的命令时，命令被作为普通 prompt 直接发送给 TUI 引擎，TUI 不会将其解释为内部命令，导致命令无效或产生意外的 AI 回复。

**根因分析：**

`chatViewProvider.ts:605-626` 中 `dispatchSlashCommand` 的 `default` case 返回 `null`（未匹配），但 `sendPrompt` 中返回 `null` 后**没有 break**，代码继续执行到 `const wsRoot = ...`，把整个 `/restore ...` 文本作为普通 prompt 发送：

```typescript
if (slashMatch) {
    await this.tuiManager.cancel();
    const result = await this.dispatchSlashCommand(cmd, args);
    if (result !== null) {
        this.postMessage({ type: 'tuiText', text: result, ... });
        break;
    }
    // result === null → 不 break，直接 fallthrough 到下面的 sendPrompt
}
// 这里把包含 /command 的文本当普通消息发送
```

**修复方案：**

1. **立即修复（P0）** — 在 `if (result !== null)` 块后增加 `return;` 或 `break;`，确保未识别命令不落执行到 sendPrompt
2. **继续方案** — 将未知命令通过 `POST /v1/threads/{id}/steer` 发送给 TUI 引擎处理（详见 Bug 1 方案 B）
3. 或全部在 `dispatchSlashCommand` 的 `default` 中调用新方法 `this.tuiManager.steerTurn(threadId, turnId, prompt)` 并 `return null` 等待 SSE

**优先级：P0（立即修复）** — 斜杠命令功能实质损坏

---

### Bug 6: `cycleMode` 前后端状态不同步

**症状：** 用户点击 ContextBar 的 mode 徽章切换模式（Agent → Plan → YOLO）时，GUI 前端立即更新 UI 显示新模式，但后端 TUI `PATCH /v1/threads/{id}` 可能因为 TUI 未就绪、网络故障等原因失败。此时前端显示的模式与实际运行模式不一致。

**根因分析：**

`App.vue:208` 前端先改了 `currentMode` 的本地状态，才发消息给后端：

```typescript
function cycleMode() {
    const modes = ['agent','plan','yolo'];
    const i = modes.indexOf(currentMode.value);
    currentMode.value = modes[(i+1)%modes.length];  // ← 先改本地状态
    vscode?.postMessage({ type: 'switchMode', mode: currentMode.value }); // ← 后发后端
}
```

`chatViewProvider.ts:845-858` 中 `switchMode` 处理可能抛出 `catch(() => {})` 静默吞掉错误：

```typescript
case 'switchMode': {
    this.tuiManager.autoApprove = mode === 'yolo';
    const currentThreadId = (this.tuiManager as any)._currentThreadId;
    if (currentThreadId) {
        this.tuiManager.updateThreadConfig(currentThreadId, { mode }).catch(() => {});
    }
    this.postMessage({ type: 'modeSwitched', mode });  // 强行报告成功
}
```

**修复方案：**

1. 后端处理成功后，再通知前端更新 UI（`modeSwitched` 消息处理中更新）
2. 后端处理失败时发送 `modeSwitchFailed` 消息，前端回滚到旧 mode
3. `updateThreadConfig` 的 `catch` 应记录错误并传播给前端

**优先级：P1（高）** — 用户可能误以为已切换模式

---

### Bug 7: `ContextBar` 模型选择器在 `availableModels` 为空时崩溃

**症状：** 当 Provider 切换但新 Provider 还没有模型列表时（如切换到 `ollama` 但未配置），`ContextBar.vue` 的 `isModelDisabled` 函数访问 `availableModels[0]` 导致抛出 `Cannot read properties of undefined` 异常。整个底部栏不渲染，但用户不容易排查原因。

**根因分析：**

`gui/src/components/ContextBar.vue:52`：

```typescript
function isModelDisabled(_modelId: string): boolean {
    if (props.availableModels.length === 0) return false;  // ✅ 长度检查
    const provider = (props.availableModels[0] as any).provider;  // ❌ 假设有 provider 字段
    if (!provider || NO_KEY_PROVIDERS.has(provider)) return false;
    return !props.providerApiKeys[provider];
}
```

当前端初始加载时或 Provider 切换期间，`availableModels` 可能为空数组。虽然有 `length === 0` 的保护，但如果 `availableModels[0]` 对象没有 `provider` 字段，访问 `undefined.provider` 会崩溃。此外 `(props.availableModels[0] as any)` 假设所有模型来自同⼀个 Provider。

**修复方案：**

1. 增加 `?.` 安全链访问：`(props.availableModels[0] as any)?.provider`
2. 从模型对象的通用字段提取 Provider（不在第一个模型上假设）
3. 添加 `v-if="availableModels.length > 0"` 在 template 层面保护

**优先级：P1（高）** — 边界情况导致组件崩溃

---

### Bug 8: `enrichPromptWithFiles` 路径穿越风险

**症状：** 用户可以通过 `@[../../../../etc/passwd]` 在工作区外引用文件，虽然只读不写，但仍构成安全风险。攻击者如果编写一个包含恶意 `@[...]` 引用的 prompt 片段（如通过社交工程诱导用户粘贴），可以探测工作区外的敏感文件内容。

**根因分析：**

`chatViewProvider.ts:1364`：

```typescript
let fullPath = path.resolve(wsRoot, filePath);
// ...
if (!fs.existsSync(fullPath)) continue;
const content = fs.readFileSync(fullPath, 'utf-8');
const preview = content.slice(0, 3000);
```

`path.resolve(wsRoot, filePath)` 如果 `filePath` 包含 `../`，解析结果可能超出 `wsRoot` 范围。虽然已用 `fs.existsSync` 检查存在性，但没有检查是否在工作区内。

**修复方案：**

1. 解析完整路径后，与 `wsRoot` 做 `path.relative()` 比对，确保不包含 `..` 前缀
2. 或使用 `path.resolve(wsRoot, filePath).startsWith(path.resolve(wsRoot))` 检查
3. 在 `enrichPromptWithFiles` 中增加路径合法性日志（用于审计）

```typescript
const fullPath = path.resolve(wsRoot, filePath);
if (!fullPath.startsWith(path.resolve(wsRoot))) {
    logger.warn(`[Security] path traversal blocked: ${filePath} → ${fullPath}`);
    continue;
}
```

**优先级：P1（高）** — 安全风险，CVSS 评分约 6.5（Medium）

---

### Bug 9: `getWorkspaceFiles` 返回类型与实际不一致

**症状：** 函数声明返回 `{ path: string; name: string }[]`，但实际 push 了 `relativePath` 和 `absolutePath` 字段。前端 @ 弹窗的 `FileItem` 接口只要求 `path` 和 `name`，多余字段虽不报错但造成类型污染。后续如果 `FileItem` 类型定义变化，可能产生难以追踪的运行时错误。

**根因分析：**

`chatViewProvider.ts:1322`：

```typescript
results.push({ path: relPath, name: entry.name, relativePath: fullPath, absolutePath: fullPath });
//                      ↑ 接口声明                ↑ 实际多出字段
```

返回类型为 `{ path: string; name: string }[]`，但实际推入对象有 4 个字段。TypeScript 检查未通过是因为函数返回类型声明宽松或使用了隐性 any。

**修复方案：**

1. 对齐接口定义：将 `getWorkspaceFiles` 返回类型更新为实际字段
2. 或移除多余字段只保留声明类型
3. 在 GUI 端统一使用 `FileItem` 类型

**优先级：P2（中）** — 不影响运行但影响类型安全

---

### Bug 10: `(this.tuiManager as any)._currentThreadId` 绕过类型检查

**症状：** 整个 `chatViewProvider.ts` 中 7 处以上使用 `(this.tuiManager as any)._currentThreadId` 访问 `TuiProcessManager` 的内部属性。如果未来 `_currentThreadId` 字段重命名或类型变化，所有引用点都会在运行时静默失效而不是在编译时捕获。

**根因分析：**

`chatViewProvider.ts` 中多处使用 `as any` 绕过类型系统访问私有属性：

```typescript
// 第 853 行
const currentThreadId = (this.tuiManager as any)._currentThreadId;

// 第 866 行
const currentThreadId = (this.tuiManager as any)._currentThreadId;

// 第 1080 行
const threadId = (this.tuiManager as any)._currentThreadId;

// 第 1119 行
const tid = (this.tuiManager as any)._currentThreadId;

// 第 1199, 1208, 1218 行同理
```

根本原因是 `ChatViewProvider` 需要获取当前活跃的 thread ID，但 `TuiProcessManager` 没有暴露对应的公开 getter 方法。

**修复方案：**

1. 在 `TuiProcessManager` 上新增公开 getter：
   ```typescript
   get currentThreadId(): string | undefined { return this._currentThreadId; }
   get currentTurnId(): string | undefined { return this._currentTurnId; }
   ```
2. 所有 `(this.tuiManager as any)._currentThreadId` 替换为 `this.tuiManager.currentThreadId`
3. 全局搜索 `as any` 用法，逐一评估是否可替换为类型安全的写法
4. 对于确实需要 `as any` 的场景（如 `fetch().json()`），添加 `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 注释

**优先级：P2（中）** — 代码维护性，不阻塞功能但增加长期维护成本

---

### Bug 11: `forkThread` 缺失 mode/model 参数，fork 线程不可定制

**症状：** `/fork` 命令创建的线程完全继承原线程的配置（model、mode），无法在 fork 时指定新的模型或模式。用户想要在同一上下文中用不同模型（如 V4 Pro vs V4 Flash）对比时，需要额外的手动切换操作。

**根因分析：**

`chatViewProvider.ts:1210`：

```typescript
case 'fork': {
    const tid = (this.tuiManager as any)._currentThreadId;
    if (!tid) return '⚠️ 没有活跃会话。';
    const forked = await this.tuiManager.forkThread(tid);
    return forked ? '✅ 已创建分支会话 ...' : '⚠️ Fork 失败。';
}
```

`tuiProcessManager.ts:885` 中 `forkThread` 只接受 id 参数，没有额外配置：

```typescript
async forkThread(id: string): Promise<ThreadSummary | null> {
    // POST /v1/threads/{id}/fork
}
```

**修复方案：**

1. `forkThread` 方法扩展为支持可选参数：
   ```typescript
   async forkThread(id: string, options?: { model?: string; mode?: string }): Promise<ThreadSummary | null>
   ```
2. 请求体中带上 `model` / `mode` 字段
3. `/fork` 命令扩展语法：`/fork` → 继承原配置；`/fork deepseek-v4-pro` → 指定 model；`/fork deepseek-v4-pro yolo` → 同时指定 model 和 mode

**优先级：P2（中）** — 增强功能

---

### Bug 12: `syncToTuiConfig` 使用纯正则解析 TOML，易出错

**症状：** `readTuiProviderConfig()` 和 `syncToTuiConfig()` 使用手写正则表达式解析 `~/.codewhale/config.toml`。当配置文件中包含转义字符、多行字符串、注释中的引号、包含 `=` 的值（如 base_url）时，解析结果可能错误。在极端情况下，正则错误可能导致配置文件被错误覆盖，造成配置丢失。

**根因分析：**

`chatViewProvider.ts:394`：

```typescript
const sectionRe = /\[providers\.(\w[\w_]*)\]([\s\S]*?)(?=\[|$)/g;
const keyMatch = body.match(/api_key\s*=\s*"([^"]+)"/);
// ...
```

这些正则假设：
- section 名只有字母数字和下划线（但 Provider 名中可能出现连字符如 `siliconflow-CN`）
- 值始终使用双引号（TOML 也支持单引号和裸值）
- 值中没有 `"` 转义
- section 之间没有空行

**修复方案：**

1. **短期** — 增强正则：支持单引号、支持值中的转义、支持包含连字符的 section 名
2. **长期** — 引入轻量 TOML 解析库（如 `@iarna/toml` 或 `smol-toml`，无依赖或轻量依赖），替代手写正则
3. 写回配置时使用 TOML 格式化库确保输出格式正确

**涉及文件：** `src/chatViewProvider.ts`

**优先级：P2（中）** — 边缘条件下可能导致配置损坏

---

### Bug 13: 测试覆盖不足 — 核心模块缺少测试

**症状：** 项目已有 `vitest.config.ts` 和少量测试文件（`chatViewProvider.test.ts`, `tuiProcessManager.test.ts`, `sessionsTreeProvider.test.ts`, `fixes.test.ts`），但以下关键模块缺少测试覆盖：

| 模块 | 行数 | 测试文件 | 状态 |
|------|------|---------|------|
| `binaryDownloader.ts` | 255行 | ❌ 无 | 缺失 |
| `secretStorage.ts` | 175行 | ❌ 无 | 缺失 |
| `logger.ts` | — | ❌ 无 | 缺失 |
| GUI 组件测试 | 多个 .vue | ⚠ 仅有 ChatView 和 ApprovalPopup | 不足 |
| `extension.ts` | 120行 | ❌ 无（集成测试） | 缺失 |

根据 `AGENTS.md` 要求：`src/*.ts` 覆盖率 ≥ 70%，`gui/src/components/*.vue` 覆盖率 ≥ 50%。

**根因分析：**

1. `binaryDownloader.ts` 依赖 `fetch` 和 GitHub API，模拟网络请求需要 mock，但未编写测试
2. `secretStorage.ts` 依赖 VS Code `SecretStorage` API，测试需要 mock（已有 `test/mocks/vscode.ts`）
3. GUI 组件测试需要 `jsdom` 环境（已有配置），但只写了 2 个组件的测试

**修复方案：**

1. 为 `binaryDownloader.ts` 编写单元测试（mock `fetch` 和 `fs`）
2. 为 `secretStorage.ts` 编写单元测试（使用已有的 vscode mock）
3. 为 `logger.ts` 编写简单测试
4. 为 GUI 核心组件（`ContextBar.vue`, `InputBox.vue`, `App.vue`）编写基本渲染和交互测试
5. 在 CI 中检查覆盖率报告

**优先级：P2（中）** — 长期维护质量

---

### Bug 14: `/memory` 命令路径硬编码为 `~/.deepseek/memory.md`

**症状：** CodeWhale TUI 从 v0.8.44 开始迁移到 `~/.codewhale/` 路径，但 celest 的 `/memory` 命令仍硬编码读取 `~/.deepseek/memory.md`。使用新版 TUI（v0.8.53+）的用户可能已将记忆文件迁移到 `~/.codewhale/memory.md`，导致 `/memory` 命令显示为空或找不到。

**根因分析：**

`chatViewProvider.ts:1170`：

```typescript
case 'memory': {
    const memPath = path.join(os.homedir(), '.deepseek', 'memory.md');
    // ...
    if (!content.trim()) return '🧠 记忆为空。在对话中输入 `# 记住：xxx` 添加。';
}
```

**修复方案：**

1. 优先读取 `~/.codewhale/memory.md`（新路径）
2. 如果不存在则回退到 `~/.deepseek/memory.md`（旧路径兼容）
3. 使用 `GET /v1/runtime/info` 中的 `config_dir` 字段获取正确的数据目录

**优先级：P2（中）** — 使用新版 TUI 的用户受影响

---

## 2. Phase 1 — 二进制下载器重构

### 涉及文件: `src/binaryDownloader.ts`

#### 2.1 多源下载 + 镜像支持

**当前：** 硬编码 `api.github.com`，没有回退

**改造后：**
```typescript
const DOWNLOAD_SOURCES = [
    { name: 'github-api', url: 'https://api.github.com/repos/Hmbown/CodeWhale/releases/latest' },
    { name: 'github-release', url: 'https://github.com/Hmbown/CodeWhale/releases/latest/download' },
    { name: 'cnb-mirror', url: 'https://cnb.cool/codewhale.net/codewhale/releases/latest' },
    { name: 'env-override', url: process.env.DEEPSEEK_TUI_RELEASE_BASE_URL },
];
```

- 支持链式回退：第一个源失败自动尝试下一个
- 支持 `DEEPSEEK_TUI_RELEASE_BASE_URL` 环境变量
- VSCode 设置项 `celest.downloadMirror`: `"github"` | `"cnb"` | `"auto"`

#### 2.2 重试机制 + 指数退避

参考 `CodeWhale/npm/codewhale/scripts/install.js`:
- 最多尝试 5 次
- 指数退避: 1s → 2s → 4s → 8s → 16s
- 可重试错误: `ENOTFOUND`, `ETIMEDOUT`, `ECONNRESET`, HTTP 5xx
- 不可重试错误: 404, 校验和不匹配, 不支持平台

#### 2.3 代理支持

- 读取 `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` 环境变量
- 通过 CONNECT 隧道 + TLS 升级下载
- 参考 npm install.js 的 proxy 实现（纯 Node.js，无第三方依赖）

#### 2.4 校验和验证

- 下载 `codewhale-artifacts-sha256.txt` 清单
- SHA-256 校验下载的二进制，防止损坏/投毒
- 参考 npm install.js 的 `verifyChecksum()` 实现

#### 2.5 二进制查找增强

**当前：** `findBinary()` 硬编码开发者个人路径
  
**改造：**
- 移除 `E:\git_code\DeepSeek-TUI-new\` 硬编码
- 新增检测 `npm root -g` 下的全局安装
- 新增检测 `npx codewhale-tui` 可用性
- 改进 Windows PATH 搜索

---

## 3. Phase 2 — Provider 生态同步

### 涉及文件: `src/secretStorage.ts`, `package.json`

#### 3.1 新增 Provider 至 24 个

> ⚠️ **当前代码状态检查（v0.1.11）：** `secretStorage.ts` 中 `PROVIDER_ENV_MAP` 实际只定义 **20 个** Provider，缺少以下 3 个：
> - **`anthropic`** — Anthropic Claude 原生 API（CodeWhale v0.8.58+）
> - **`minimax`** — MiniMax 平台
> - **`openai-codex`** — OpenAI Codex CLI（CodeWhale v0.8.56+）
> 
> 需要在 Phase 2 实现中补充这 3 个 Provider 的定义、默认 Base URL 和默认 Model。

| Provider ID | API Key Env | Base URL Env | 默认模型 |
|-------------|-------------|-------------|---------|
| `anthropic` | `ANTHROPIC_API_KEY` | `ANTHROPIC_BASE_URL` | `claude-sonnet-4-6` |
| `openai-codex` | `OPENAI_CODEX_ACCESS_TOKEN` | `CODEX_BASE_URL` | `gpt-5.5` |
| `huggingface` (已有但需确认) | `HUGGINGFACE_API_KEY` | `HUGGINGFACE_BASE_URL` | `deepseek-ai/DeepSeek-V4-Pro` |
| `minimax` | `MINIMAX_API_KEY` | `MINIMAX_BASE_URL` | `minimax-2.7` |

#### 3.2 更新默认模型

- `deepseek`: `deepseek-v4-flash`（不变）
- `moonshot`: `kimi-k2.6` → `kimi-k2.7-code`
- `xiaomi-mimo`: `mimo-v2.5-pro` → 确认最新
- 对照 `CodeWhale/config.example.toml` 逐项核对

#### 3.3 更新 package.json 的 provider 枚举

`celest.provider` 的枚举值列表需对齐 24 个 Provider：
```json
"celest.provider": {
    "enum": [
        "deepseek", "deepseek-cn", "openai", "openai-codex",
        "anthropic", "nvidia-nim", "ollama", "huggingface",
        "arcee", "moonshot", "sglang", "vllm",
        "siliconflow", "siliconflow-CN", "fireworks",
        "xiaomi-mimo", "wanjie-ark", "volcengine",
        "openrouter", "novita", "atlascloud", "dashscope",
        "minimax"
    ]
}
```

---

## 4. Phase 3 — TUI API/协议对齐

### 涉及文件: `src/tuiProcessManager.ts`, `src/protocol.ts`

#### 4.1 SSE 事件格式对齐

需逐版本检查 CodeWhale 的 SSE 事件变更：

| 事件 | celest 状态 | CodeWhale v0.8.61 |
|------|-----------|-------------------|
| `turn.started` | ✅ 已实现 | 字段可能有增减 |
| `message.delta` | ✅ 已实现 | 确认 |
| `tool.started` | ✅ 已实现 | 确认 |
| `tool.progress` | ✅ 已实现 | 确认 |
| `tool.completed` | ✅ 已实现 | 确认 |
| `agent.*` | ✅ 基本实现 | 新增 role/model 字段 |
| `goal.*` | ❌ 未实现 | 新增目标生命周期事件 |
| `sandboxDenied` | ✅ 已实现 | 确认 |
| `turn.completed` | ✅ 已实现 | 新增 usage 扩展字段 |

#### 4.2 新增 API 端点

| 端点 | 说明 | 优先级 |
|------|------|--------|
| `POST /v1/threads/{id}/undo` | 线程回退 | ⭐⭐⭐ |
| `POST /v1/snapshots/{id}/restore` | 快照恢复 | ⭐⭐ |
| `POST /v1/threads/goal/set` | 设置目标 | ⭐⭐ |
| `POST /v1/threads/goal/clear` | 清除目标 | ⭐⭐ |
| `GET /v1/models` | 模型列表 | ⭐⭐ |
| `POST /v1/provider/fallback` | Provider 回退 | ⭐⭐ |
| `POST /v1/voice` | 语音转录 | ⭐ |
| `POST /v1/voice/send` | 语音发送 | ⭐ |
| `GET /v1/subagents` | 子 Agent 状态 | ⭐⭐ |
| `POST /v1/subagents/{id}/cancel` | 取消子 Agent | ⭐⭐ |

#### 4.3 启动参数对齐

`startInternal()` 中传递给 `codewhale-tui serve --http` 的参数：
- 当前: `--http` + 端口
- 新增: `--allowed-tools`, `--disallowed-tools`, `--max-turns`（可选）
- 需检查 CodeWhale `serve` 子命令是否有参数变更

#### 4.4 Threads API 字段变更

检查 `POST /v1/threads` 和 `POST /v1/threads/{id}/turns` 的请求/响应 schema 变化：
- `CreateThreadRequest` 新增字段
- `TurnRequest` 新增字段
- 响应格式调整

#### 4.5 SSE 断线恢复机制

**问题描述：** 当前 `streamEvents` 没有 SSE 断线自动重连逻辑。如果 TUI 进程在对话中途重启或网络临时中断，SSE 流断开后整个会话中断，前端停留在"等待回复"状态，用户只能手动中断。

**根因分析（`tuiProcessManager.ts`）：**

```typescript
// streamEvents — SSE 连接在 fetch 层面只有 signal.abort 控制
// 没有 onclose / onerror 重连逻辑
```

`_generation` 递增机制提供了丢弃旧事件的能力，但没有利用它来重建 SSE 连接。

**修复方案：**

1. 在 `streamEvents` 中增加 `retryDelay` 和 `maxRetries`：
   ```typescript
   async streamEvents(threadId: string, signal: AbortSignal, generation: number): Promise<void> {
       while (this._generation === generation) {
           try {
               const resp = await fetch(`${base}/threads/${threadId}/events?seq=${seq}`, { signal });
               // 正常处理事件流...
               break; // 正常结束
           } catch (err) {
               if (signal.aborted) break;
               // 指数退避重连
               await new Promise(r => setTimeout(r, retryDelay));
               retryDelay = Math.min(retryDelay * 2, 30000);
           }
       }
   }
   ```
2. 构造重连请求时带上 `seq` 参数，避免重复消费已处理的事件
3. 如果重连成功，通知前端恢复流式输出；如果超过 `maxRetries`，发出 `tuiWarning` 事件
4. 新会话启动时（`generation` 递增）自动中断旧重连循环

**优先级：P2（中）** — 长时间运行场景

---

#### 4.6 启动参数验证与扩展

**问题描述：** `startInternal()` 中传递给 `codewhale-tui serve --http` 的参数仅包含 `--http` 和端口。CodeWhale v0.8.54+ 支持额外启动参数，未利用导致功能受限。

**当前代码（`tuiProcessManager.ts`）：**

```typescript
// 仅 --http + --port + --host + --insecure
args.push('serve', '--http', '--port', String(port), '--host', '127.0.0.1', '--insecure');
```

**需要补充的参数：**

| 参数 | 用途 | CodeWhale 版本 |
|------|------|---------------|
| `--allowed-tools` | 允许的工具列表 | v0.8.54+ |
| `--disallowed-tools` | 禁止的工具列表 | v0.8.54+ |
| `--max-turns` | 单会话最大轮次限制 | v0.8.56+ |
| `--allowed-directories` | 允许的文件访问目录 | v0.8.58+ |

**修复方案：**

1. 扩展 `startConfig` 接口支持可选参数
2. 从 VSCode 配置 `celest.allowedTools` / `celest.disallowedTools` 读取
3. 启动时仅添加非空的参数（保持向后兼容旧版 TUI）
4. 通过 `GET /v1/runtime/info` 返回的 `version` 字段做版本检测，仅传递新版 TUI 支持的参数

**涉及文件：** `src/tuiProcessManager.ts`

**优先级：P2（中）** — 安全性和功能增强

---

#### 4.7 同步 CodeWhale v0.8.53→v0.8.61 新特性

celest v0.1.11 对齐 CodeWhale v0.8.53，需要同步以下 v0.8.54→v0.8.61 新增的重要特性：

| 特性 | CodeWhale 版本 | 涉及内容 | 优先级 |
|------|---------------|---------|--------|
| **WhaleFlow 运行时** | v0.8.61 | Worker 配置文件（role/permissions/shell/tools/model-route）、跨 Provider 模型注册表 | ⭐⭐⭐ |
| **Durable Goal 模式** | v0.8.61 | 跨轮次目标追踪、token/time 会计、验证器表决门控 | ⭐⭐⭐ |
| **子 Agent 按角色分配模型** | v0.8.61 | 不同角色（reviewer/verifier/implementer）路由到不同模型 | ⭐⭐⭐ |
| **Provider 回退链** | v0.8.59 | 主 Provider 失败时自动降级到备用 Provider | ⭐⭐⭐ |
| **Anthropic Claude 原生接入** | v0.8.58 | Messages API 适配器（非 OpenAI 方言） | ⭐⭐⭐ |
| **Hooks v2** | v0.8.58 | tool_call_before 返回 JSON decision（allow/deny/ask） | ⭐⭐ |
| **语音输入 (/voice)** | v0.8.59 | 本地录音→转录→发送 | ⭐⭐ |
| **线程回退 (undo)** | v0.8.59 | 对话回滚、快照恢复 | ⭐⭐ |
| **Goal 生命周期 API** | v0.8.59 | POST /v1/threads/goal/set/get/clear | ⭐⭐ |
| **Constitution 提示词系统** | v0.8.58 | YAML 源 + Python 渲染 system prompt | ⭐⭐ |
| **HuggingFace Provider** | v0.8.59 | HF Inference Providers 接入 | ⭐⭐ |
| **OpenAI Codex Provider** | v0.8.56 | ChatGPT/Codex CLI OAuth 复用 | ⭐⭐ |
| **Voice dictation** | v0.8.59 | 通过 sox/rec/arecord 录音 → provider 转写 | ⭐ |
| **Thread rewind & snapshot** | v0.8.59 | POST /v1/threads/{id}/undo, POST /v1/snapshots/{id}/restore | ⭐⭐ |
| **Model-specific system prompt** | v0.8.58 | 每个模型的 context window/定价/特性不同 | ⭐⭐ |
| **Compact 命令行** | v0.8.57 | 一键 release 脚本、changelog 切片 | ⭐ |
| `/goal` 命令系列 | v0.8.59 | pause/resume/complete/blocked/clear | ⭐⭐⭐ |

**各特性具体实现路径：**

**4.5.1 WhaleFlow 运行时**
- 新增 `protocol.ts` 类型：`WorkerProfile`, `ModelRegistry`, `ProviderAdapter`
- 新增 `tuiProcessManager.ts` 方法：`listWorkers()`, `getWorkerStatus(id)`, `createWorker(profile)`
- 端点：`GET /v1/workers`, `GET /v1/workers/{id}`, `POST /v1/workers`
- 在 GUI 右侧面板新增 Workflows 区域（与现有 Agents 面板分开）

**4.5.2 Durable Goal**
- 新增 `protocol.ts` 类型：`GoalRecord`, `GoalStatus`
- 新增 `tuiProcessManager.ts` 方法：`setGoal()`, `getGoal()`, `clearGoal()`, `updateGoal()`
- 端点：`POST /v1/threads/goal/set`, `GET /v1/threads/goal/get`, `POST /v1/threads/goal/clear`
- 新增 GUI 组件 `GoalPanel.vue`
- 对接 chatViewProvider 中的 goal.* SSE 事件

**4.5.3 Anthropic Provider**
- 在 `secretStorage.ts` 的 `PROVIDER_ENV_MAP` 新增 `anthropic` 条目
- 在 `package.json` 的 `celest.provider` 枚举新增 `anthropic`
- GUI 设置面板新增 Anthropic 凭证配置

**4.5.4 Provider 回退链**
- 新增 VSCode 配置项 `celest.fallbackProviders`（数组）
- 新增 TUI 方法：`setFallbackProviders(providers)`, `getFallbackStatus()`
- 端点：`POST /v1/provider/fallback`
- GUI ContextBar 显示当前回退链状态

**4.5.5 Hooks v2**
- 检查 `POST /v1/hooks/execute` 是否有新端点
- 在 approval 流程中加入 hooks decision 支持
- 处理 `hookDecision` SSE 事件

**4.5.6 Voice**
- 新增 `/voice`, `/voice-send`, `/voice-control` 命令到 `dispatchSlashCommand`
- 通过 TUI HTTP API 调用：`POST /v1/voice`
- GUI 新增语音输入按钮（可选）

**4.5.7 Thread Undo/Snapshot**
- 新增 `tuiProcessManager.ts` 方法：`undoThread()`, `restoreSnapshot()`
- 端点：`POST /v1/threads/{id}/undo`, `POST /v1/snapshots/{id}/restore`
- 在 GUI 聊天界面增加"回退一步"按钮

**4.5.8 Constitution 提示词系统**
- CodeWhale v0.8.58+ 的 system prompt 由 YAML 源 + Python 渲染
- celest 需要读取 TUI 的 `/v1/runtime/info` 中的 constitution 版本信息
- 确保 `startInternal()` 中传递的 system prompt 参数与 Constitution 系统兼容

**4.5.9 Model-specific 提示词**
- CodeWhale v0.8.58 开始，每个模型有不同的 context window、定价、thinking 特性
- celest 的 `startInternal()` 需要从 TUI `/v1/runtime/info` 获取模型能力信息
- GUI 模型选择器中显示模型上下文窗口大小

**涉及文件：**
- `src/protocol.ts` — 新增 WhaleFlow/Goal/Worker 类型
- `src/tuiProcessManager.ts` — 新增所有 API 方法
- `src/chatViewProvider.ts` — 新增 SSE 事件处理
- `src/secretStorage.ts` — Anthropic Provider
- `gui/src/components/GoalPanel.vue` — 新增
- `gui/src/App.vue` — 集成新面板
- `package.json` — Provider 枚举

---

## 5. Phase 4 — GUI 前端升级

### 涉及文件: `gui/src/App.vue`, `gui/src/components/*.vue`

#### 5.1 斜杠命令弹窗（Slash Popup）改进

**当前**（`InputBox.vue:195-201`）：仅检测 `/` 后弹窗
**改造：**
- 扩展本地命令列表，匹配 `dispatchSlashCommand` 的全部命令
- 新增命令分类：`会话管理`、`模型/Provider`、`任务管理`、`系统命令`
- 支持命令描述和参数提示

#### 5.2 @ 文件引用改进

**当前**（`App.vue:237`）：`@([^\s\[]\S*(?:\s+\S+)+)` 强制包装
**改造：**
- 支持拖拽文件到输入框时自动生成 `@[path]`
- 改进去重逻辑
- 用户可手动输入 `@[...]` 而不会被自动补全干扰

#### 5.3 新面板

- **上下文监控面板** — token 使用率进度条、自动 compaction 建议
- **目标面板** — 当前 Goal 状态（`codex/v0.8.59+`）
- **子 Agent 状态面板** — 运行中的子 Agent 列表和进度

#### 5.4 Provider 切换 UI

- 下拉选择 Provider 后自动加载对应的凭证配置
- 显示当前 Provider 连接状态

#### 5.5 Mode 切换前后端同步修复（关联 Bug 6）

**问题描述：** `cycleMode` 在前端先更新 `currentMode` 本地状态，再异步发送给后端。如果后端拒绝切换（TUI 未就绪、PATCH 失败），前端显示的模式与实际不符。

**修复方案：**

1. 将 Mode 切换改为"乐观更新 + 失败回滚"模式：
   - 前端先保留旧 mode 值
   - 发送 `switchMode` 给后端，等待 `modeSwitched` 确认
   - 如果确认到达，更新 UI
   - 如果超时或收到 `modeSwitchFailed`，回滚到旧 mode
2. `chatViewProvider.ts` 的 `switchMode` handler 中：
   - 不再 `catch(() => {})` 静默吞掉 `updateThreadConfig` 的错误
   - 失败时发送 `modeSwitchFailed` 消息给前端
3. `ContextBar.vue` 的 mode 徽标改为监听后端推过来的 mode 状态，而不是本地计算

**涉及文件：** `gui/src/App.vue`, `gui/src/components/ContextBar.vue`, `src/chatViewProvider.ts`

**优先级：P1（高）** — 关联 Bug 6

---

## 6. Phase 5 — 配置管理增强

### 涉及文件: `package.json`, `src/extension.ts`

#### 6.1 新增 VSCode 配置项

```json
{
    "celest.downloadMirror": {
        "type": "string",
        "default": "auto",
        "enum": ["auto", "github", "cnb"],
        "description": "二进制下载源选择：auto = 自动回退, github = GitHub, cnb = CNB 镜像"
    },
    "celest.releaseVersion": {
        "type": "string",
        "default": "",
        "description": "固定 TUI 版本（留空=latest），例如 'v0.8.61'"
    },
    "celest.autoCompactThreshold": {
        "type": "number",
        "default": 80,
        "description": "上下文占用百分比阈值，超过后自动提示压缩（0=禁用）"
    },
    "celest.proxyEnabled": {
        "type": "boolean",
        "default": false,
        "description": "通过系统代理下载二进制"
    },
    "celest.showContextBar": {
        "type": "boolean",
        "default": true,
        "description": "显示上下文使用率状态条"
    }
}
```

#### 6.2 Anthropic 配置支持

在设置面板中新增 Anthropic 的独立配置页（API Key, Base URL, Model）

#### 6.3 TOML 配置解析改进（关联 Bug 12）

**问题描述：** `readTuiProviderConfig()` 和 `syncToTuiConfig()` 使用手写正则解析 `~/.codewhale/config.toml`，在特殊字符（转义引号、多行值、含连字符的 section 名）下可能解析错误，极端情况下写回操作可能损坏配置文件。

**修复方案：**

1. **短期** — 增强现有的正则匹配：
   - section 名正则支持连字符（如 `siliconflow-CN`）
   - 值正则支持单引号 `'...'` 和原始值
   - 写回时使用 `JSON.stringify` 转义引号
2. **长期** — 引入轻量 TOML 解析/格式化库：
   - `smol-toml`（2.6KB, zero-dependency, ESM）
   - 或 `@iarna/toml`（成熟稳定）
3. 写回配置时添加文件备份 (`~/.codewhale/config.toml.bak`)
4. 对写回结果做一轮验证性读取，确保语法正确

**涉及文件：** `src/chatViewProvider.ts`

**优先级：P2（中）** — 边缘条件配置损坏

---

## 7. Phase 6 — 上下文管理优化

### 涉及文件: `src/tuiProcessManager.ts`, `src/chatViewProvider.ts`, `gui/src/`

#### 7.1 自动上下文监控

**监听上下文状态**：
- 每个 turn 完成后，检查 `GET /v1/usage` 或 SSE 事件中的 token 用量
- 维护上下文占用状态：`{ usedTokens, totalTokens, usagePercent }`

**触发动作**：
- `usagePercent > celest.autoCompactThreshold`（默认 80%）：
  - 自动弹出提示："上下文占用已达 X%，建议 /compact 压缩"
  - 如果 >90%，用户可设置自动压缩
- 每隔 5 个 turn 自动检查一次

#### 7.2 智能 Compaction

- 自动 compaction：在发新 prompt 前，如果上下文 >85%，自动发送 `POST /v1/threads/{id}/compact`
- 保留最近 3 轮对话的完整上下文，压缩更早的历史
- 压缩后通知用户压缩结果

#### 7.3 注入冗余优化

**当前问题**——每轮对话都会注入：
```typescript
enrichedPrompt += '\n\n[系统提示: 预计运行超过10秒的shell命令请使用background:true参数...]';
```

**改进**：
- 只在首轮对话注入系统提示
- 后续轮次通过 TUI 的 system prompt 机制注入（每 thread 设置一次）
- 大幅减少每轮的 token 消耗

#### 7.4 上下文可视化

GUI 状态栏新增：
- 当前上下文 token 量 / 总量（如 `125K/1M`）
- 使用率进度条（`████████░░ 78%`）
- 点击可执行 `/compact`

#### 7.5 测试覆盖与代码质量改进（关联 Bug 10, 13）

**目标：** 对齐 AGENTS.md 中后端 ≥70% 覆盖率、GUI ≥50% 覆盖率的要求。

**具体任务：**

1. **新增 `binaryDownloader.ts` 测试**（核心模块，255行，当前 0 测试）：
   - Mock `fetch` 和 `fs` API
   - 覆盖：成功下载、平台检测、文件已存在跳过、网络错误重试、校验和验证
   - 使用 `vitest` 的 `vi.mock` 模拟 Node.js 内置模块

2. **新增 `secretStorage.ts` 测试**：
   - 使用已有的 `test/mocks/vscode.ts` 模拟 SecretStorage
   - 覆盖：存储/读取/删除 Provider Key、旧版迁移逻辑、批量获取

3. **GUI 组件测试补充**：
   - `ContextBar.vue` — mode 显示、模型选择、git 状态渲染
   - `InputBox.vue` — @ 弹窗触发、/ 弹窗触发、粘贴处理
   - `App.vue` — 消息路由、面板切换

4. **TypeScript 严格模式加固**（关联 Bug 10）：
   - 减少 `as any` 使用（全局搜索替换为具名 getter）
   - 为 `fetch().json()` 添加类型守卫

**涉及文件：** `src/binaryDownloader.ts`, `src/secretStorage.ts`, `gui/src/components/*.vue`, `vitest.config.ts`

**优先级：P2（中）** — 长期维护质量保障

---

## 8. 发布计划

| 版本 | 内容 | 预计工作量 |
|------|------|-----------|
| **v0.2.0-alpha.1** | Bug 修复（斜杠命令 + @冲突 + 上下文监控） + Phase 1 下载器 | 3-5 天 |
| **v0.2.0-alpha.2** | Phase 2 Provider 同步 + Phase 3 TUI API 对齐 | 3-5 天 |
| **v0.2.0-beta.1** | Phase 4 GUI + Phase 5 配置 + Phase 6 上下文优化 | 3-5 天 |
| **v0.2.0-rc.1** | 集成测试 + Windows/Mac/Linux 全平台验证 | 2-3 天 |
| **v0.2.0** | 正式发布 | — |

### 修复优先级

1. ⚡ **P0 — 立即修复**：Bug 1（斜杠命令）+ Bug 5（fallthrough 安全）
2. ⚡ **P0 — 立即修复**：Bug 3（上下文降智）
3. ⚡ **P0 — 立即修复**：Phase 1 二进制下载器（解决新 PC 安装困难）
4. 🔵 **P1 — 高优先级**：Bug 2（@ 文件引用冲突）+ Bug 8（路径穿越）
5. 🔵 **P1 — 高优先级**：Bug 6（mode 状态同步）+ Bug 7（ContextBar 崩溃）
6. 🟡 **P2 — 中优先级**：Bug 9（类型对齐）+ Bug 10（as any 清理）+ Bug 11（fork 参数）
7. 🟡 **P2 — 中优先级**：Bug 12（TOML 解析）+ Bug 13（测试覆盖）+ Bug 14（/memory 路径）
8. 🟡 **P2 — 中优先级**：Bug 15（SSE 断线恢复）+ Bug 16（启动参数验证）
9. 🟢 **P3 — 正常**：Phase 2-6 功能增强 + Provider 补充

---

## 9. 关键风险

1. **SSE 事件格式不兼容** — CodeWhale v0.8.53→v0.8.61 可能有 8 个版本的 SSE schema 变更，需要逐个版本对照调试
2. **API 认证变化** — CodeWhale v0.8.59+ 的 `auth_required` 字段可能影响 celest 的连接流程
3. **线程模型变更** — CodeWhale 引入了 WhaleFlow、Durable Worker 等新概念，可能影响 Thread/Turn/Session 的语义
4. **向后兼容** — celest 用户可能还在使用旧版 TUI 二进制，新增 API 调用需要兼容旧版本
5. **Windows 路径处理** — GUI 端的路径正则对中文路径的支持需额外测试
6. **SSE 连接中断** — 长时间运行中 SSE 连接可能因网络抖动断开，当前 `streamEvents` 没有自动重连机制。需要设计优雅的断线恢复策略（generation 递进 + 自动重置事件流）
7. **TOML 配置损坏** — 使用正则解析和写回 `~/.codewhale/config.toml`（Bug 12），在特殊字符或多行值场景下可能损坏配置文件。建议尽快用轻量 TOML 解析库替代手写正则
8. **测试覆盖不足** — Bug 13 指出的核心模块（`binaryDownloader.ts`, `secretStorage.ts`）缺少测试，重构 Phase 1（下载器）和 Phase 2（Provider）时容易引入回归

---

## 附录: 参考源码位置

| 文件 | 用途 |
|------|------|
| `CodeWhale/npm/codewhale/scripts/install.js` | 二进制下载器参考（重试、代理、校验和） |
| `CodeWhale/config.example.toml` | Provider 配置完整列表 |
| `CodeWhale/CHANGELOG.md` | 版本变更日志 |
| `CodeWhale/.cnb.yml` | CNB 镜像 CI 配置 |
| `CodeWhale/docs/CNB_MIRROR.md` | CNB 镜像说明 |
| `CodeWhale/crates/app-server/src/` | TUI HTTP API 服务端源码 |
| `CodeWhale/crates/commands/registry.rs` | 斜杠命令注册表 |
| `CodeWhale/docs/INSTALL.md` | 安装指南（含中国镜像配置） |
