# Celest v0.1.10 手动集成测试方案

> 日期：2026-06-06  
> 变更范围：CodeWhale TUI v0.8.53 同步 + 多 Provider 凭证管理  
> 修改文件：secretStorage.ts, tuiProcessManager.ts, chatViewProvider.ts, binaryDownloader.ts, extension.ts, package.json, ARCHITECTURE.md, AGENTS.md, SettingsPanel.vue, ContextBar.vue, i18n.ts

---

## 测试环境准备

1. VS Code 打开 `e:\git_code\celest` 项目
2. 确保 TUI 二进制可用（`codewhale-tui` 在 PATH 或 `celest.binaryPath` 已配置）
3. 按 F5 启动扩展开发宿主（Extension Development Host）
4. 在左侧活动栏点击 Celest 图标打开聊天面板

---

## T1 — 版本号显示

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| T1.1 | 打开 Celest → 设置 → 关于 | 版本显示为 `v0.1.10`（从 package.json 动态读取） |

---

## T2 — 二进制下载器

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| T2.1 | 设置 → 关于 → 点击"下载 codewhale" | 从 `Hmbown/CodeWhale` GitHub Release 下载 `codewhale-tui-windows-x64.exe` |
| T2.2 | 删除本地二进制 → 重新打开 Celest | 弹出提示"codewhale-tui binary not found. Download automatically?"（不再是 deepseek-tui） |
| T2.3 | 点击"手动指定路径" | 对话框标题为 "Select codewhale-tui binary" |

---

## T3 — 设置面板通用 Tab

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| T3.1 | 设置 → 通用 | 不再显示全局 API Base URL 和 API Key 输入框（已迁移到模型 Tab 的 Provider 凭证区） |
| T3.2 | 通用 → 界面语言 | 切换 zh-CN ↔ en，UI 即时变化 |
| T3.3 | 通用 → 自动下载二进制 | 开关正常切换 |

---

## T4 — 设置面板模型 Tab（Provider 凭证管理）

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| T4.1 | 设置 → 模型 → Provider 下拉 | 列出全部 20 个 Provider，分为主列表和 "legacy" 区域 |
| T4.2 | 选择 Provider = OpenAI | 默认模型自动切换为 `gpt-4.1` |
| T4.3 | 在 "Provider 凭证" 区选择 "配置 Provider" = OpenAI | 显示 OpenAI 的 API Key / Base URL / 默认模型输入框 |
| T4.4 | 输入 OpenAI API Key: `sk-test123` → 点击保存 | 设置提示 "Settings saved"，Key 存储到系统密钥链 |
| T4.5 | 关闭设置 → 重新打开 → 模型 → 配置 Provider = OpenAI | API Key 输入框为空（安全不回显），但显示 `✓ 已设置` |
| T4.6 | 配置 Provider = DeepSeek 的 API Key | 同上流程，应能独立保存 |
| T4.7 | 配置 Provider = Ollama 的 Base URL 为 `http://localhost:11434/v1` | 不需要 API Key，保存后生效 |
| T4.8 | 切换到 Provider = Ollama | Base URL 自动切换为 `http://localhost:11434/v1`，默认模型为 `deepseek-v4-flash` |
| T4.9 | pathSuffix 输入框 | 输入 `/chat/completions` → 保存 → TUI 重启后应传递给环境变量 `CODEWHALE_PATH_SUFFIX` |

---

## T5 — 聊天窗口底部 ContextBar

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| T5.1 | 查看聊天窗口底部 | 格式：`[V4 Flash ▼] \| ⚙ Agent \| Turn 1 \| ⎇ main`（无 Provider 标签） |
| T5.2 | 模型下拉（Provider = DeepSeek，Key 已配） | 显示 4 个 DeepSeek 模型：V4 Pro / V4 Flash / DeepSeek Chat / DeepSeek Reasoner，全部可选 |
| T5.3 | 设置 → 模型 → 切换到 Provider = OpenAI（Key 未配） | 模型下拉显示 GPT-4.1 🔒 / GPT-4o 🔒，置灰不可选 |
| T5.4 | 设置 → 配置 OpenAI API Key → 保存 | 模型下拉中 GPT-4.1 / GPT-4o 恢复正常可选（无 🔒） |
| T5.5 | 切换到 Provider = Ollama | 模型始终可选（Ollama 本地部署无需 Key） |
| T5.6 | 选择不同模型 | 模型切换后，ContextBar 显示新模型名，TUI 后端收到 switchModel 消息 |

---

## T6 — Provider 环境变量注入

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| T6.1 | 配置 DeepSeek API Key + OpenAI API Key → 保存 | 查看 Celest 输出日志（Output → Celest），应包含 `[Config] injected env vars for N provider(s)` |
| T6.2 | TUI 启动后查看进程环境变量 | `DEEPSEEK_API_KEY` 和 `OPENAI_API_KEY` 均已设置（需用调试工具或日志确认） |
| T6.3 | 在 TUI 内部执行 `/provider openai` | TUI 可以切换到 OpenAI 并使用已注入的 Key（无需重启 Celest） |

---

## T7 — 旧数据迁移

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| T7.1 | 如果之前已保存过旧版 `celest.apiKey`（全局 Key） | 首次启动时自动迁移到 `celest.provider.deepseek.apiKey`，日志包含 `[SecretStore] migrated legacy apiKey → deepseek provider` |
| T7.2 | 迁移后旧 Key 被删除 | 再次启动不再重复迁移（标记 `__celest_migrated_v010` 存在） |

---

## T8 — 工具审批弹窗（TOOL_META）

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| T8.1 | Agent 模式下触发 `git_status` | 审批弹窗显示类型 "Git 状态"，影响 "低 — 只读操作"，自动批准 |
| T8.2 | 触发 `agent_open` | 审批弹窗显示类型 "子代理创建"，影响 "高 — 创建子代理会话"，需要手动确认 |
| T8.3 | 触发 `run_tests` | 审批弹窗显示类型 "测试运行"，影响 "中 — 执行测试" |

---

## T9 — 国际化文案

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| T9.1 | 设置界面语言为中文 | 所有新增文案（Provider 凭证、配置 Provider、API 路径后缀等）显示为中文 |
| T9.2 | 切换为英文 | 同上，所有文案切换为英文 |
| T9.3 | 检查"正在连接"文案 | 显示"正在连接 CodeWhale TUI..."（不再是 DeepSeek TUI） |
| T9.4 | 检查二进制下载进度文案 | 显示"正在下载 codewhale-tui..." / "codewhale-tui 下载完成" |

---

## T10 — 文档一致性

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| T10.1 | 查看 `ARCHITECTURE.md` 迁移表 | 新增"当前 TUI 版本 v0.8.53"和"会话文件 ~/.codewhale/"行 |
| T10.2 | 查看 `ARCHITECTURE.md` Phase 表 | 包含 Phase 6.1/6.2/6.3/7 |
| T10.3 | 查看 `AGENTS.md` 架构边界 | TUI 后端描述为 `codewhale-tui 独立进程 → HTTP/SSE 通信` |
| T10.4 | 查看 `package.json` | `celest.provider` 枚举包含 19 个 Provider，binary 相关描述均为 codewhale-tui |

---

## T11 — 回归测试

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| T11.1 | 发送 prompt "hello" | 正常收到回复 |
| T11.2 | `/version` 命令 | 显示 Celest / CodeWhale TUI 版本 |
| T11.3 | `/model deepseek-v4-pro` | 模型切换成功 |
| T11.4 | 恢复历史会话 | 正常显示历史消息 |
| T11.5 | 新建会话 | 清空聊天 + 重置状态 |
| T11.6 | `ctrl+l` 聚焦输入框 | 焦点回到输入框 |
| T11.7 | 右键文件 → "Add to Celest Chat" | 文件路径正确添加到 @ 命令 |
| T11.8 | 审批弹窗 allow/deny/remember | 正常响应 |

---

## 签名

| 角色 | 姓名 | 日期 | 结果 |
|------|------|------|------|
| 测试执行 | | | ⬜ PASS / ⬜ FAIL |
| 代码审查 | | | ⬜ PASS / ⬜ FAIL |

```
不管选什么模型 API 路径后缀 都显示 “自建 OpenAI 兼容网关专用，如 /chat/completions”，API 路径后缀是干什么的？
deepseek的API Key明明设置了，并且可用，但显示没设置，聊天框底下的模型选择也给我锁住了，deepseek Chat DeepSeek Reasoner,这两个官方api中都不提供了，给我删除
默认模型要做成选项 不是输入
Base URL 如果已经配置了，自动写入

中英文：Reasoning Effort 选项没有变化

设置中Provider 切换后，聊天窗口底部 ContextBar 模型选择 对应错误，出现的是上一次选择的Provider对应的模型
Provider需要增加千问模型的配置，现在没有，我有时候想用千问3.7模型

```