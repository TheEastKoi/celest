# Celest Phase 2 — 全面测试方案

> 本文档定义 Phase 2 的测试策略、测试用例、自动化验证流程。
> 配套脚本：`test/phase2_verify.py`

---

## 一、测试层次

```
┌──────────────────────────────────────────────────────┐
│  Level 4: E2E 集成测试                                │
│  (VS Code Extension Host + TUI 进程 端到端)          │
├──────────────────────────────────────────────────────┤
│  Level 3: Vue 组件测试                                │
│  (ChatView / App / InputBox 交互验证)                 │
├──────────────────────────────────────────────────────┤
│  Level 2: 后端单元测试  ← 已有 7 个 vitest            │
│  (tuiProcessManager / sessionsTreeProvider)           │
├──────────────────────────────────────────────────────┤
│  Level 1: 静态分析 + 模式检查  ← phase2_verify.py    │
│  (代码模式、文件结构、构建产物)                       │
└──────────────────────────────────────────────────────┘
```

---

## 二、Phase 2 功能 × 测试矩阵

| 功能 | Level 1 静态 | Level 2 单元 | Level 3 组件 | Level 4 E2E |
|------|:-----------:|:-----------:|:-----------:|:----------:|
| 2.1 流式打字机 | ✅ regex | — | ✅ | — |
| 2.2 Thinking 实时流 | ✅ regex | — | ✅ | — |
| 2.3 工具调用卡片 | ✅ regex | — | ✅ | — |
| 2.4 Stop 按钮 | ✅ regex | ✅ | ✅ | — |
| 2.5 自动重试 | ✅ regex | ✅ | — | ✅ |
| 2.6 localStorage 缓存 | ✅ regex | — | ✅ | — |
| 2.7 协议类型完善 | ✅ regex | ✅ | — | — |
| 2.8 消息路由 | ✅ regex | ✅ | — | — |

- ✅ = 已实现或可在此层级验证
- — = 当前版本暂不覆盖（后续版本补充）

---

## 三、Level 1 — 静态代码模式检查

### 执行方式
```bash
# 仅静态分析（不跑构建）
python test/phase2_verify.py --quick

# 带详细输出
python test/phase2_verify.py --quick --verbose

# 完整验证（含构建+测试）
python test/phase2_verify.py
```

### 13 项检查清单

| # | 检查项 | 验证方式 | 关键正则 |
|---|--------|---------|---------|
| 1 | 文件结构完整性 | 15 个文件存在性检查 | — |
| 2 | 协议类型定义 | protocol.ts | `AcpTextContent` / `AcpToolCallContent` / `AcpReasoningContent` / `AcpContentUnion` |
| 3 | 后端消息路由 | chatViewProvider.ts | `tuiText` / `tuiReasoning` / `tuiToolCall` / `tuiToolResult` / `tuiReconnected` / `tuiCrashed` |
| 4 | 流式打字机 | ChatView.vue | `appendText` / `ensureAssistant` / 原地追加 `lastPart.content =` |
| 5 | Thinking 实时流 | ChatView.vue | `appendReasoning` / `thinking` 检查 |
| 6 | 工具调用卡片 | ChatView.vue | `addToolCall` / `updateToolResult` / `.tool-call-card` / `.status-pending` |
| 7 | Stop 按钮 | App.vue | `.stop-btn` / `handleStop` / `cancelPrompt` / `#f85149` |
| 8 | 自动重试 | tuiProcessManager.ts | `attemptRestart` / `_retryCount` / `Math.pow(2` / `_maxRetries` |
| 9 | localStorage 缓存 | ChatView.vue | `STORAGE_KEY` / `loadFromStorage` / `saveToStorage` / `watch(…deep: true)` / `500` |
| 10 | InputBox disabled | InputBox.vue | `disabled?.*boolean` / `:disabled="disabled"` / `props.disabled` |
| 11 | ContextBar props | ContextBar.vue | `defineProps` / `modelName.*string` / `turnCount.*number` |
| 12 | 构建产物 | out/ | extension.js (10-50 KB) / index.js (100-500 KB) |
| 13 | vitest 测试 | 运行 7 个测试 | `7 passed` |

---

## 四、Level 2 — 后端单元测试

### 已有测试（7 个）

#### tuiProcessManager.test.ts（5 个）

| # | 测试用例 | 验证点 |
|---|---------|-------|
| 1 | `should initialize without error` | 构造函数不抛异常 |
| 2 | `should expose sessionId as undefined before start` | start 前 sessionId 为 undefined |
| 3 | `should throw when sending prompt without connection` | 未连接时 sendPrompt 抛 "TUI not yet connected" |
| 4 | `cancel() should not throw when not connected` | 未连接时 cancel 不抛异常 |
| 5 | `dispose() should not throw` | dispose 不抛异常 |

#### sessionsTreeProvider.test.ts（2 个）

| # | 测试用例 | 验证点 |
|---|---------|-------|
| 6 | `should return placeholder sessions in Phase 0` | 返回 2 个占位会话 |
| 7 | `should fire tree data change event on refresh` | refresh 触发 onDidChangeTreeData |

### Phase 2 新增测试建议（待实现）

```typescript
// tuiProcessManager.test.ts 新增
describe('Phase 2: Auto-retry', () => {
    it('should set _disposed=true on dispose()');
    it('should increment _retryCount on restart attempt');
    it('should reset _retryCount on successful reconnection');
    it('should fire tuiCrashed event on max retries');
    it('should fire tuiReconnected event on successful restart');
    it('should use exponential backoff (2^n * base)');
});

describe('Phase 2: Status events', () => {
    it('should fire onStatusChange with "restarting" during retry');
    it('should fire onStatusChange with "connected" after restart');
});
```

---

## 五、Level 3 — Vue 组件测试建议

> 当前版本未实现 Vue 组件测试（vitest + @vue/test-utils），以下为建议用例。

### ChatView 组件

```
describe('ChatView — 流式打字机', () => {
    it('appendText 第一次调用应创建新的 assistant 消息');
    it('appendText 连续调用应在同一个 text part 上追加');
    it('appendText 中间插入 thinking part 后应创建新的 text part');
    it('appendText 空字符串不应改变消息列表');
});

describe('ChatView — Thinking 流', () => {
    it('appendReasoning 应创建 thinking 类型的 part');
    it('连续 appendReasoning 应在同一 thinking part 上追加');
});

describe('ChatView — 工具卡片', () => {
    it('addToolCall 应创建 status=pending 的 part');
    it('updateToolResult 应按 callId 更新匹配的 part');
    it('updateToolResult 应切换 status 为 success/error');
    it('updateToolResult 不存在 callId 时应静默忽略');
});

describe('ChatView — localStorage', () => {
    it('组件挂载后应从 localStorage 恢复消息');
    it('消息变化后应防抖写入 localStorage');
    it('clearMessages 应清除 localStorage');
    it('损坏的 localStorage 数据应静默忽略');
});
```

### App.vue 组件

```
describe('App — Stop 按钮', () => {
    it('promptRunning=false 时应隐藏 Stop 按钮');
    it('promptRunning=true 时应显示 Stop 按钮');
    it('点击 Stop 应发送 cancelPrompt 消息');
});

describe('App — 消息路由', () => {
    it('收到 tuiText 应调用 chatRef.appendText');
    it('收到 tuiReasoning 应调用 chatRef.appendReasoning');
    it('收到 tuiToolCall 应调用 chatRef.addToolCall');
    it('收到 tuiToolResult 应调用 chatRef.updateToolResult');
    it('收到 tuiStatus restarting 应设置 tuiReady=false');
    it('收到 tuiCrashed 应追加错误消息');
});
```

### InputBox 组件

```
describe('InputBox — disabled', () => {
    it('disabled=true 时 textarea 应有 disabled 属性');
    it('disabled=true 时 Enter 不应发送消息');
    it('disabled=true 时 Send 按钮应为 disabled');
});
```

---

## 六、Level 4 — E2E 集成测试

> 需要 VS Code Extension Host 环境，当前版本未实现。

### 手动测试流程

#### 6.1 流式输出版本验证

```
前置条件: VS Code 已打开，Celest 扩展已激活

步骤:
1. 在输入框输入: "用 Python 写一个 fibonacci 函数"
2. 按 Enter 发送
3. 观察: 文本应逐 token 出现（非一次性全部显示）

预期结果:
- ✅ 每个 token 追加到同一段文本，无闪烁
- ✅ 输入框变为禁用状态
- ✅ Stop 按钮 (⏹) 出现在 Send 按钮右侧
- ✅ ContextBar 中 Turn 计数 +1
```

#### 6.2 Thinking 块验证

```
步骤:
1. 输入一个需要复杂推理的问题: "分析这段代码的性能瓶颈"
2. 等待 TUI 返回 thinking

预期结果:
- ✅ 折叠的 "🧠 Thinking" 块出现在回复开头
- ✅ 预览显示前 80 字符
- ✅ 点击展开后显示完整思考内容（半透明样式）
```

#### 6.3 工具调用验证

```
步骤:
1. 输入: "读取 package.json 文件"
2. 等待 TUI 调用工具

预期结果:
- ✅ 工具调用卡片出现: 🔧 read_file → pending
- ✅ 卡片显示 JSON 参数: {"path": "package.json"}
- ✅ 工具返回后卡片状态变为 success（绿色）
- ✅ Result 区域显示文件内容预览
```

#### 6.4 Stop 按钮验证

```
步骤:
1. 输入一个会运行较长时间的 prompt
2. 在生成过程中点击 ⏹ Stop 按钮

预期结果:
- ✅ 按钮消失，promptRunning=true → false
- ✅ 输入框恢复可用
```

#### 6.5 消息持久化验证

```
步骤:
1. 发送几条消息（含用户消息 + assistant 回复）
2. 关闭 VS Code（或重新加载 WebView）
3. 重新打开 Celest

预期结果:
- ✅ 之前的消息全部恢复显示
- ✅ 用户消息和 assistant 回复均恢复
```

#### 6.6 自动重试验证

```
步骤:
1. 找到并手动 kill deepseek-tui 进程（taskkill /f /im deepseek-tui.exe）
2. 观察日志 / UI

预期结果:
- ✅ TUI 状态变为 "restarting"
- ✅ 约 2 秒后尝试重连
- ✅ 最多重试 3 次，间隔 2s → 4s → 8s
- ✅ 重连成功后 tuiReady=true
- ✅ 3 次失败后显示 "TUI crashed" 错误
```

---

## 七、快速验证命令

```bash
# === 方式 1: Python 自动验证（最全面） ===

cd E:\git_code\celest

# 仅静态代码检查
python test/phase2_verify.py --quick --verbose

# 完整验证（含构建+vitest）
python test/phase2_verify.py --verbose


# === 方式 2: 手动分步验证 ===

# 步骤 1: 文件完整性
dir src\protocol.ts src\tuiProcessManager.ts src\chatViewProvider.ts

# 步骤 2: 构建
build.bat

# 步骤 3: 单元测试
test.bat

# 步骤 4: 构建产物检查
dir out\extension.js out\gui\index.html


# === 方式 3: git diff 检查改动范围 ===

git diff --stat HEAD~1   # 查看上次提交改动文件
git diff HEAD~1          # 查看改动细节
```

---

## 八、通过的判定标准

| 条件 | 阈值 |
|------|------|
| 文件结构 | 15 个必需文件全部存在 |
| 协议类型 | 5 个类型定义全部存在 |
| 消息路由 | 7 个路由分发全部存在 |
| 代码模式 | 全部 65+ 正则匹配通过 |
| 构建产物 | extension.js 10-50 KB, gui ~210 KB |
| 单元测试 | 7/7 passed, 0 failed |
| 构建退出码 | 0 |

**全部通过 → Phase 2 验证成功 ✅**

---

**最后更新:** 2026-05-20  
**配套脚本:** `test/phase2_verify.py`
