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

---

## 九、Phase 5 测试策略 (2026-05-24)

### 9.1 Phase 5 功能 × 测试矩阵

| 功能 | Level 1 静态 | Level 2 单元 | Level 3 组件 | Level 4 E2E |
|------|:-----------:|:-----------:|:-----------:|:----------:|
| 5.1 SettingsPanel 设置面板 | ✅ regex | ✅ | ✅ | ✅ |
| 5.2 模型下拉选择器 | ✅ regex | ✅ | — | ✅ |
| 5.3 API Key SecretStorage | ✅ regex | ✅ | — | ✅ |
| 5.4 二进制自动下载 | ✅ regex | ✅ | — | ✅ |
| 5.5 i18n 国际化 | ✅ regex | ✅ | ✅ | ✅ |
| 5.6 配置持久化 | ✅ regex | ✅ | — | ✅ |
| 5.7 Mode 切换 (agent/plan/yolo) | ✅ regex | ✅ | ✅ | ✅ |
| 5.8 Runtime Info | ✅ regex | ✅ | — | ✅ |

### 9.2 Level 1 — 静态代码模式检查

新增文件检查（Phase 5 新增模块）:

| # | 检查项 | 文件 | 关键正则 |
|---|--------|------|---------|
| P5-1 | SecretStore 封装 | secretStorage.ts | `class SecretStore` / `getApiKey` / `setApiKey` / `deleteApiKey` |
| P5-2 | BinaryDownloader | binaryDownloader.ts | `class BinaryDownloader` / `download()` / `getPlatformBinaryName` / `getLatestRelease` |
| P5-3 | SettingsPanel 组件 | SettingsPanel.vue | `<SettingsPanel` / `activeTab` / `handleSave` / `general` / `model` / `about` |
| P5-4 | i18n 模块 | i18n.ts | `setLocale` / `t(` / `zh-CN` / `en` / `getAvailableModels` |
| P5-5 | 模型配置接口 | tuiProcessManager.ts | `SessionConfig` / `setConfig(` / `getConfig()` / `updateThreadModel(` |
| P5-6 | Runtime Info API | tuiProcessManager.ts | `getRuntimeInfo(` / `RuntimeInfo` / `runtime/info` |
| P5-7 | 配置项扩展 | package.json | `celest.locale` / `celest.provider` / `celest.reasoningEffort` |
| P5-8 | 模型选择器 UI | App.vue | `model-select` / `handleModelChange` / `switchModel` |
| P5-9 | Settings 消息路由 | chatViewProvider.ts | `getSettings` / `saveSettings` / `switchModel` / `downloadBinary` / `browseBinary` |
| P5-10 | SecretStore 初始化 | extension.ts | `initSecretStore` / `getSecretStore` / `onDidChangeConfiguration` |

### 9.3 Level 2 — 单元测试建议

```typescript
// secretStorage.test.ts (新增)
describe('SecretStore', () => {
    it('should store and retrieve API key');
    it('should return undefined for unset key');
    it('should delete key');
    it('should store and retrieve provider');
});

// tuiProcessManager.test.ts (新增 Phase 5)
describe('Phase 5: SessionConfig', () => {
    it('should default to deepseek-v4-flash model');
    it('should update config via setConfig()');
    it('should return copy via getConfig()');
    it('should pass model to CreateThreadRequest');
    it('should pass DEEPSEEK_API_KEY env var when configured');
});

describe('Phase 5: updateThreadModel', () => {
    it('should PATCH /v1/threads/{id} with model');
    it('should return false when TUI not connected');
});

describe('Phase 5: getRuntimeInfo', () => {
    it('should GET /v1/runtime/info');
    it('should return null when TUI not connected');
});

// binaryDownloader.test.ts (新增)
describe('BinaryDownloader', () => {
    it('should detect platform correctly');
    it('should generate correct binary name for platform');
    it('should return local path when binary exists');
    it('should report hasLocalBinary() correctly');
});
```

### 9.4 Level 3 — Vue 组件测试建议

```typescript
// SettingsPanel.test.ts (新增)
describe('SettingsPanel', () => {
    it('should render three tabs: General, Model, About');
    it('should default to General tab');
    it('should switch tab on click');
    it('should emit close on overlay click');
    it('should emit save with config data');
    it('should toggle API key visibility');
    it('should show key status (set/unset)');
    it('should display available models in dropdown');
    it('should display reasoning effort options');
    it('should display version info in About tab');
    it('should display download progress');
});

// App.vue (新增 Phase 5)
describe('App — Model Selector', () => {
    it('should display model dropdown when TUI connected');
    it('should post switchModel on selection change');
    it('should update currentModel on modelSwitched message');
});

describe('App — Settings Integration', () => {
    it('should open SettingsPanel on openSettings message');
    it('should request settings on panel open');
    it('should forward saveSettings to backend');
    it('should update locale on localeChanged message');
});

// i18n.ts (新增)
describe('i18n', () => {
    it('should return Chinese text for zh-CN locale');
    it('should return English text for en locale');
    it('should fallback to key when translation missing');
    it('should fallback to English when Chinese missing');
    it('should list available models');
    it('should list reasoning effort options');
});
```

### 9.5 Level 4 — E2E 测试 prompt 汇总

> 完整用例见 `docs/INTEGRATION_TEST.md` Phase 5 章节。

| # | 测试项 | 测试 prompt | 验证方法 |
|---|--------|-------------|---------|
| E1 | 设置面板打开/关闭 | — (UI 操作) | 点击 ⚙ 按钮，检查弹窗 |
| E2 | Tab 切换 | — (UI 操作) | 点击"模型"/"关于"Tab |
| E3 | 模型切换验证 | `"你是什么模型？"` | Output 日志 `model=deepseek-v4-pro` |
| E4 | API Key 保存 | — (UI 操作) | 重启 VS Code 后 Key 仍存在 |
| E5 | API Key 传递 | — (UI 操作) | 日志 `passing DEEPSEEK_API_KEY via env` |
| E6 | 二进制下载 | — (UI 操作) | 日志 `[BinaryDownloader] downloading` |
| E7 | 语言切换 | — (UI 操作) | 面板标题变 "Celest Settings" |
| E8 | 配置持久化 | — (UI 操作) | 重启后模型/语言保持 |
| E9 | Runtime Info | — (UI 操作) | 关于 Tab 显示 TUI 版本号 |
| E10 | Thread 兼容性 | `"hello"` → 切换 → `"你是什么模型？"` | 回复显示切换后的模型 |
| E11 | 完整配置 E2E | `"hello"` | 全流程无报错 |

### 9.6 测试执行顺序

```
1. Level 1 静态检查（新增 10 项文件/代码模式检查）
2. Level 2 单元测试（secretStorage + tuiProcessManager Phase 5 + binaryDownloader）
3. 构建验证（node build.mjs → 0 退出码）
4. Level 4 手动 E2E（按 INTEGRATION_TEST.md Phase 5 章节逐项执行）
   - 先测 UI 类（设置面板 Tab/开关/语言）
   - 再测数据流类（模型切换/API Key/配置持久化）
   - 最后测端到端（完整配置流程）
```

### 9.7 Phase 5 通过的判定标准

| 条件 | 阈值 |
|------|------|
| 新增文件 | 4 个必需文件存在（secretStorage.ts / binaryDownloader.ts / SettingsPanel.vue / i18n.ts） |
| 修改文件 | 5 个文件含 Phase 5 代码（tuiProcessManager / chatViewProvider / extension / App.vue / package.json） |
| 构建产物 | extension.js > 50 KB（含新增模块），GUI > 250 KB（含 SettingsPanel） |
| 代码模式 | 10 项静态检查全部通过 |
| 配置项 | package.json 含 locale / provider / reasoningEffort 3 项 |

**全部通过 → Phase 5 验证成功 ✅**

---

**最后更新:** 2026-05-24  
**配套文档:** `INTEGRATION_TEST.md` (Phase 5 章节)
