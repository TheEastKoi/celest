# Celest — 集成测试手册 v3.0

> CodeWhale v0.8.45 · Celest API 覆盖率 37/37 (100%) · 50 单元测试  
> 使用方法：逐项测试，记录实际结果。发现问题填入末尾"问题汇总"。

---

## 一、测试环境准备

### 1.1 环境检查

| 项目 | 要求 | 验证命令 |
|------|------|---------|
| VS Code | 1.85+ | `Code → Help → About` |
| Node.js | 18+ | `node -v` |
| codewhale-tui | v0.8.45 | `codewhale-tui --version` |
| API Key | 已配置 | Settings → API Key 状态绿色 |

### 1.2 启动 Celest

```
1. F5 或 Run Extension (Extension Development Host)
2. 侧边栏 → Celest 图标 🌙 → 点击打开面板
3. 等待 "Connecting..." 消失，输入框变为可用
4. Output 面板 → 下拉选 "Celest" → 确认日志无错误
```

### 1.3 测试用工作区

在 Celest 工作区根目录创建测试文件：

```bash
echo "hello celest" > test_celest.txt
echo "print('test')" > test_script.py
mkdir test_dir && echo "nested" > test_dir/nested.txt
```

---

## 二、连接与基础通信

### 2.1 连接验证

| # | 测试项 | 操作 | 预期 |
|---|--------|------|------|
| 2.1.1 | TUI 启动 | 打开 Celest 面板 | 连接横幅消失，ContextBar 显示模型名 |
| 2.1.2 | 健康检查 | Output → Celest | 日志含 `[Thread] TUI HTTP server ready` |
| 2.1.3 | Runtime Info | Output → Celest | 日志含 `version` 字段（非空） |
| 2.1.4 | ContextBar | 查看底部栏 | `Model | Mode | Turn 0 | SessionId` |

### 2.2 基础对话

| # | 测试项 | Prompt | 验证方法 |
|---|--------|--------|---------|
| 2.2.1 | 简单回复 | `hello` | 收到文字回复 |
| 2.2.2 | 中文回复 | `你好，介绍一下你自己` | 收到中文回复 |
| 2.2.3 | 多轮对话 | (1) `我叫小明` (2) `我叫什么？` | 第二轮正确回答"小明" |

---

## 三、聊天核心功能

### 3.1 流式打字机

| # | 测试项 | Prompt | 验证方法 |
|---|--------|--------|---------|
| 3.1.1 | 逐字出现 | `写一首五言绝句` | 文本逐块出现，无闪烁 |
| 3.1.2 | 自动滚动 | 发送长 prompt | 消息区自动滚动到底部 |

### 3.2 Markdown 渲染

| # | 测试项 | Prompt | 验证方法 |
|---|--------|--------|---------|
| 3.2.1 | 标题 | `用 markdown 写一个 H1 标题 "Hello"` | 标题大字体渲染 |
| 3.2.2 | 代码块 | `写一段 Python hello world，用代码块` | 等宽字体 + 语法高亮 |
| 3.2.3 | 列表 | `列出 3 个水果，用 markdown 列表` | 项目符号正确 |
| 3.2.4 | 行内代码 | `解释 \`console.log()\` 的作用` | 灰色圆角背景 |

### 3.3 Thinking 块

| # | 测试项 | Prompt | 验证方法 |
|---|--------|--------|---------|
| 3.3.1 | 推理可见 | `分析 O(n^2) 和 O(n log n) 的区别` | Thinking 块出现，可折叠 |
| 3.3.2 | 折叠展开 | 点击 Thinking 块 | 展开显示完整内容 |
| 3.3.3 | 简单无推理 | `1+1=?` | 无 Thinking 块 |

### 3.4 工具调用卡片

| # | 测试项 | Prompt | 验证方法 |
|---|--------|--------|---------|
| 3.4.1 | 读取文件 | `读取 test_celest.txt 的内容` | 工具卡片：read_file → success |
| 3.4.2 | 列出目录 | `列出当前目录的文件` | 工具卡片：list_dir → success |
| 3.4.3 | Shell 执行 | `运行命令 echo "test"` | 工具卡片显示输出 |
| 3.4.4 | View Diff | `修改 test_celest.txt，内容改为 "updated"` | 出现 "View Diff" 按钮 |
| 3.4.5 | View Diff 点击 | 点击 "View Diff" | VS Code diff editor 打开 |

### 3.5 Stop 按钮

| # | 测试项 | 操作 | 验证方法 |
|---|--------|------|---------|
| 3.5.1 | 显示/隐藏 | 发送长 prompt → 点 Stop | 生成中可见，停止后消失 |
| 3.5.2 | 恢复发送 | Stop 后再发 `hello` | 正常回复 |

---

## 四、右侧面板（8 个）

### 4.0 面板通用

| # | 测试项 | 操作 | 预期 |
|---|--------|------|------|
| 4.0.1 | 折叠展开 | 点击面板标题 | 面板内容折叠/展开 |
| 4.0.2 | 面板顺序 | 从上到下 | 📋Work → 📐Plan → 📌Tasks → 🤖Agents → 📊Context → 🧩Skills → 📊Usage → 📖Help |

### 4.1 Work 面板

| # | 测试项 | Prompt | 验证方法 |
|---|--------|--------|---------|
| 4.1.1 | 创建 todo | `创建一个 todo：1.读取文件 2.分析内容 3.总结` | Work 面板显示 3 个任务 |
| 4.1.2 | 状态更新 | 等待 AI 执行 | 任务状态随进度变化 |
| 4.1.3 | 清空 | 输入 `/clear` 或点 🗑 | Work 面板清空 |

### 4.2 Plan 面板

| # | 测试项 | Prompt | 验证方法 |
|---|--------|--------|---------|
| 4.2.1 | 计划显示 | `制定一个分析 test_celest.txt 的计划` | Plan 面板显示步骤 |
| 4.2.2 | 清空 | `/clear` | Plan 面板清空 |

### 4.3 Tasks 面板

| # | 测试项 | Prompt | 验证方法 |
|---|--------|--------|---------|
| 4.3.1 | 后台任务 | `在后台运行：搜索项目中所有 .ts 文件` | Tasks 面板显示任务 |
| 4.3.2 | 状态标签 | 观察任务状态 | 排队中/运行中/完成 |
| 4.3.3 | 自动刷新 | 等待 5 秒 | 面板自动刷新 |

### 4.4 Agents 面板

| # | 测试项 | Prompt | 验证方法 |
|---|--------|--------|---------|
| 4.4.1 | 子代理创建 | `同时读取 test_celest.txt 和 test_script.py，并行分析` | Agents 面板显示子代理 |
| 4.4.2 | 状态变化 | 观察子代理状态 | spawned → running → completed |
| 4.4.3 | 清空 | `/clear` | Agents 面板清空 |

### 4.5 Context 面板

| # | 测试项 | 操作 | 验证方法 |
|---|--------|------|---------|
| 4.5.1 | 用量显示 | 发送 2-3 条 prompt | 显示 token 用量和费用 |
| 4.5.2 | Git 状态 | 修改文件（不提交） | 显示分支名和未暂存计数 |
| 4.5.3 | MCP 计数 | 如果配置了 MCP 服务器 | 显示服务器数量 |
| 4.5.4 | 空状态 | 新会话无数据时 | 显示引导文字 |

### 4.6 Skills 面板

| # | 测试项 | 操作 | 验证方法 |
|---|--------|------|---------|
| 4.6.1 | 技能列表 | 打开 Skills 面板 | 显示已安装的技能 |
| 4.6.2 | 启用/禁用 | 点击技能开关 | 状态切换，列表刷新 |
| 4.6.3 | 空状态 | 无技能时 | 显示空状态提示 |

### 4.7 Usage 面板

| # | 测试项 | 操作 | 验证方法 |
|---|--------|------|---------|
| 4.7.1 | 总量显示 | 展开 Usage 面板 | 显示 Total Cost / Turns / Input / Output |
| 4.7.2 | 分组切换 | 切换 Group By | 按天/模型/线程分组 |
| 4.7.3 | 时间筛选 | 选择时间范围 | 数据变化 |

### 4.8 Help 面板

| # | 测试项 | 操作 | 验证方法 |
|---|--------|------|---------|
| 4.8.1 | 打开帮助 | 输入 `/help` | Help 面板显示命令列表 |
| 4.8.2 | 命令分类 | 查看分类标签 | Core / Session / Debug 等 |

---

## 五、@ 提及与 / 命令

### 5.1 @ 提及

| # | 测试项 | 操作 | 预期 |
|---|--------|------|------|
| 5.1.1 | 触发弹窗 | 输入 `@` | 弹窗出现，显示文件列表 |
| 5.1.2 | 过滤搜索 | 输入 `@test` | 过滤到含 "test" 的文件 |
| 5.1.3 | 无匹配 | 输入 `@zzznotexist` | 显示 "No matching files" |
| 5.1.4 | 键盘导航 | `@` → `↓` `↑` `Enter` | 选中文件并替换 |
| 5.1.5 | 鼠标选择 | 点击文件 | 选中并替换 |
| 5.1.6 | Esc 关闭 | 弹窗中按 `Esc` | 弹窗关闭 |

### 5.2 / 命令

| # | 测试项 | 操作 | 预期 |
|---|--------|------|------|
| 5.2.1 | 触发 | 输入 `/` | 弹窗出现，显示命令列表 |
| 5.2.2 | 过滤 | 输入 `/com` | 过滤到匹配命令 |
| 5.2.3 | 选择 | `Enter` 选中 `/clear` | 输入框变为 `/clear ` |
| 5.2.4 | /clear | 发送 `/clear` | 清空聊天 + 三个面板 |
| 5.2.5 | /compact | 发送 `/compact` | 显示 "✅ Context compacted" |
| 5.2.6 | /help | 发送 `/help` | Help 面板显示 |
| 5.2.7 | 互斥 | 同时触发 @ 和 / | 不同时显示两个弹窗 |

---

## 六、审批流程

> **前提：** 确保 ContextBar 模式为 Agent（非 YOLO）

### 6.1 审批弹窗

| # | 测试项 | Prompt | 预期 |
|---|--------|--------|------|
| 6.1.1 | 触发审批 | `运行命令 echo hello` | 弹窗出现，显示 exec_shell |
| 6.1.2 | 工具信息 | — | 显示工具类型 "Shell 命令"，影响 "高" |
| 6.1.3 | 倒计时 | — | 显示 "Auto-deny in 4:XX" |

### 6.2 决策

| # | 测试项 | 操作 | 预期 |
|---|--------|------|------|
| 6.2.1 | Allow | 点击 "允许本次" | 工具执行，结果显示 |
| 6.2.2 | Allow Session | 先 Deny，再发 `运行命令 echo test2` → 点击 "信任会话" | 后续不再弹窗 |
| 6.2.3 | Deny | 点击 "拒绝" | 工具卡片显示 error |

### 6.3 YOLO 模式

| # | 测试项 | 操作 | 预期 |
|---|--------|------|------|
| 6.3.1 | 切换 YOLO | 点击 ContextBar mode → YOLO | 模式切换成功 |
| 6.3.2 | 跳审 | `创建 test_yolo.txt，内容为 test` | 直接执行，无审批弹窗 |
| 6.3.3 | 恢复审批 | 切回 Agent → `运行命令 echo test` | 审批弹窗恢复 |

---

## 七、设置面板

### 7.1 打开/关闭

| # | 测试项 | 操作 | 预期 |
|---|--------|------|------|
| 7.1.1 | 齿轮按钮 | 点击标题栏 ⚙ | 设置面板弹出 |
| 7.1.2 | 遮罩关闭 | 点击遮罩区域 | 面板关闭 |
| 7.1.3 | Esc 关闭 | 按 Esc | 面板关闭 |
| 7.1.4 | 命令面板 | `Ctrl+Shift+P` → `Celest: Open Settings` | 面板打开 |

### 7.2 Tab 内容

| # | 测试项 | Tab | 预期内容 |
|---|--------|-----|---------|
| 7.2.1 | 通用 | 通用 | API Base URL / API Key / 语言 / 二进制路径 |
| 7.2.2 | 模型 | 模型 | 默认模型 / 推理深度 / 提供商 |
| 7.2.3 | 关于 | 关于 | 版本号 / TUI 版本 / Node 版本 / VS Code 版本 |

### 7.3 API Key

| # | 测试项 | 操作 | 预期 |
|---|--------|------|------|
| 7.3.1 | 未设置 | 清空 Key 保存 | 红色 "未设置" |
| 7.3.2 | 设置 | 输入 Key 保存 | 绿色 "已设置 ✓" |
| 7.3.3 | 持久化 | 重启 VS Code | Key 仍存在 |
| 7.3.4 | 显示/隐藏 | 点击 👁 | 密码可见/圆点切换 |

### 7.4 模型切换

| # | 测试项 | Prompt | 验证方法 |
|---|--------|--------|---------|
| 7.4.1 | 下拉框 | — | 标题栏下拉框含 V4 Pro / V4 Flash |
| 7.4.2 | V4 Pro | 切换 → `你是什么模型？` | Output 日志 `model=deepseek-v4-pro` |
| 7.4.3 | V4 Flash | 切换 → `你是什么模型？` | Output 日志 `model=deepseek-v4-flash` |
| 7.4.4 | 跨轮次保持 | 切换 → New Session | 模型保持上次选择 |

### 7.5 语言切换

| # | 测试项 | 操作 | 预期 |
|---|--------|------|------|
| 7.5.1 | 默认中文 | 首次打开 | 设置面板标题 "Celest 设置" |
| 7.5.2 | 英文 | 切换 English → 保存 | 标题 "Celest Settings" |
| 7.5.3 | 不可译项 | 查看模型下拉框 | 始终 V4 Pro / V4 Flash |

### 7.6 二进制下载

| # | 测试项 | 操作 | 预期 |
|---|--------|------|------|
| 7.6.1 | 下载按钮 | 关于 Tab → 下载二进制 | 进度提示 |
| 7.6.2 | 手动选择 | 浏览按钮 → 选择 exe | 路径更新 |

---

## 八、会话管理

### 8.1 Sessions TreeView

| # | 测试项 | 操作 | 预期 |
|---|--------|------|------|
| 8.1.1 | 空状态 | 首次打开 | "No sessions yet" |
| 8.1.2 | 新建会话 | 发送 `hello` | TreeView 出现新条目 |
| 8.1.3 | 标题显示 | 发送 `用"项目分析"作为标题` | 显示标题而非 Thread id |
| 8.1.4 | 日期格式 | 看条目描述 | 本地化日期（如 "May 27, 01:30"） |
| 8.1.5 | Tooltip | 悬停 | Model + Mode + 更新时间 |
| 8.1.6 | 点击聚焦 | 点击条目 | 焦点移到输入框 |

### 8.2 ContextBar

| # | 测试项 | 验证点 | 预期 |
|---|--------|--------|------|
| 8.2.1 | 模型名 | — | V4 Flash / V4 Pro |
| 8.2.2 | Mode 切换 | 点击 mode | Agent → Plan → YOLO 循环 |
| 8.2.3 | Turn 计数 | 发送 3 条消息 | Turn 1 → 2 → 3 |
| 8.2.4 | Git 分支 | Git 仓库中 | `⎇ main` 或 `⎇ main*` (dirty) |
| 8.2.5 | 非 Git | 非 Git 目录 | 不显示分支信息 |

---

## 九、/compact 命令

| # | 测试项 | 操作 | 预期 |
|---|--------|------|------|
| 9.1 | 前端拦截 | 输入 `/compact` 发送 | 显示 "✅ Context compacted" |
| 9.2 | 后端双保险 | 发送后检查 Output | 日志 `[Compact] thread xxx compacted` |
| 9.3 | 无活跃线程 | New Session 后直接 `/compact` | 显示 "No active thread" 错误 |

---

## 十、SSE 事件验证

> **验证方法：** Output → Celest → 搜索对应事件名

### 10.1 Agent 事件

| # | 事件 | 触发方式 | 日志搜索 |
|---|------|---------|---------|
| 10.1.1 | agent.spawned | 发 prompt 触发并行子代理 | `[SSE] event=agent.spawned` |
| 10.1.2 | agent.progress | 子代理执行中 | `[SSE] event=agent.progress` |
| 10.1.3 | agent.completed | 子代理完成 | `[SSE] event=agent.completed` |

### 10.2 Approval 事件

| # | 事件 | 触发方式 | 日志搜索 |
|---|------|---------|---------|
| 10.2.1 | approval.required | `运行命令 echo test` | `[SSE] approval.required` |
| 10.2.2 | approval.decided | 点击 Allow/Deny | `[SSE] approval.decided` |
| 10.2.3 | approval.timeout | 等待 5 分钟不操作 | `[SSE] approval.timeout` |

### 10.3 Turn 事件

| # | 事件 | 触发方式 | 日志搜索 |
|---|------|---------|---------|
| 10.3.1 | turn.started | 发送任意 prompt | `[SSE] event=turn.started` |
| 10.3.2 | turn.completed | 回复完成 | `[SSE] event=turn.completed` |
| 10.3.3 | turn.interrupt_requested | 生成中点 Stop | `[SSE] event=turn.interrupt_requested` |

### 10.4 其他事件

| # | 事件 | 触发方式 | 日志搜索 |
|---|------|---------|---------|
| 10.4.1 | item.started/delta/completed | 发 prompt | 流式消息事件 |
| 10.4.2 | sandbox.denied | 沙箱环境 + 不安全操作 | `[SSE] sandbox.denied` |

---

## 十一、API 端点快速验证

> 以下使用 `curl` 在 TUI 运行时直接测试。TUI 启动命令：
> ```bash
> codewhale-tui serve --http --port 18787 --host 127.0.0.1 --insecure
> ```

### 11.1 健康检查

```bash
curl http://127.0.0.1:18787/health
# 预期: ok
```

### 11.2 Runtime Info

```bash
curl http://127.0.0.1:18787/v1/runtime/info
# 预期: JSON 含 version, bind_host, port
```

### 11.3 线程 CRUD

```bash
# 创建线程
curl -X POST http://127.0.0.1:18787/v1/threads \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","mode":"agent"}'
# 预期: JSON 含 id, created_at

# 列出线程
curl http://127.0.0.1:18787/v1/threads
# 预期: JSON 数组

# 线程摘要
curl http://127.0.0.1:18787/v1/threads/summary?limit=10
# 预期: JSON 数组（轻量）
```

### 11.4 会话管理

```bash
curl http://127.0.0.1:18787/v1/sessions?limit=10
# 预期: {"sessions": [...]}
```

### 11.5 Skills

```bash
curl http://127.0.0.1:18787/v1/skills
# 预期: {"directory":"...","warnings":[],"skills":[...]}
```

### 11.6 MCP

```bash
curl http://127.0.0.1:18787/v1/apps/mcp/servers
curl http://127.0.0.1:18787/v1/apps/mcp/tools
# 预期: JSON 数组
```

### 11.7 用量

```bash
curl "http://127.0.0.1:18787/v1/usage?group_by=day"
# 预期: {"totals":{...},"buckets":[...]}
```

### 11.8 工作区状态

```bash
curl http://127.0.0.1:18787/v1/workspace/status
# 预期: {"workspace":"...","git_repo":true/false,...}
```

### 11.9 自动化

```bash
curl http://127.0.0.1:18787/v1/automations
# 预期: JSON 数组（可能为空）
```

---

## 十二、关键 E2E 场景

### 12.1 完整对话流程

```
1. 打开 Celest → 等待连接
2. 发 "hello" → 收到回复
3. 发 "读取 test_celest.txt" → 工具卡片出现
4. 审批弹窗 → Allow → 结果返回
5. 切 V4 Pro → 发 "你是什么模型？" → 回复含 V4 Pro
6. 发 /clear → 清空一切
7. 关闭 VS Code → 重开 → 消息恢复
```

### 12.2 并行子代理

```
1. 发 "同时分析 test_celest.txt 和 test_script.py，并行读取并总结"
2. Agents 面板出现 2 个子代理
3. 观察状态变化
4. 全部完成后 ChatView 显示合并结果
```

### 12.3 配置迁移

```
1. 设置 API Key → 切换模型为 V4 Pro → 切换语言为 English
2. 保存 → 重启 VS Code
3. 验证：Key 存在、模型 V4 Pro、UI 英文
```

### 12.4 错误恢复

```
1. 手动 kill codewhale-tui 进程
2. Output 日志显示重试
3. 自动恢复或显示错误
```

---

## 十三、问题汇总

| # | 严重度 | 阶段 | 问题描述 | 复现步骤 | 截图 |
|---|--------|------|---------|---------|------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |

---

**测试完成签名:** _____________  
**测试日期:** _____________  
**发现问题总数:** _____
