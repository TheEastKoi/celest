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
