# Celest — 架构文档

## 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│  VS Code Extension (Celest)                                  │
│                                                              │
│  ┌─────────────────────┐   ┌─────────────────────────────┐  │
│  │  WebView (Vue 3)     │   │  Extension Host (Node.js)    │  │
│  │                      │   │                              │  │
│  │  App.vue             │   │  extension.ts                │  │
│  │  ├── ChatView.vue    │   │  ├── chatViewProvider.ts     │  │
│  │  ├── InputBox.vue    │   │  ├── sessionsTreeProvider.ts │  │
│  │  ├── ThinkingBlock.vue│  │  ├── tuiProcessManager.ts   │  │
│  │  ├── ContextBar.vue  │◄──┤  ├── binaryDownloader.ts     │  │
│  │  ├── SettingsPanel.vue│  │  └── secretStorage.ts        │  │
│  │  ├── ApprovalPopup.vue│  │                              │  │
│  │  └── i18n.ts          │   │                              │  │
│  └─────────────────────┘   └──────────┬───────────────────┘  │
│         postMessage()                  │ spawn + HTTP/SSE    │
└────────────────────────────────────────┼────────────────────┘
                                         │
                              ┌──────────▼──────────────────┐
                              │  CodeWhale TUI (Rust binary)   │
                              │  codewhale-tui serve --http    │
                              │  - Agent 循环 (turn_loop)      │
                              │  - 工具系统 (78+ tools)        │
                              │  - 权限引擎 (ExecPolicy)       │
                              │  - 会话持久化 (SQLite)         │
                              │  - 子代理管理                  │
                              │  - v0.8.44+                   │
                              └─────────────────────────────┘
```

## 模块清单

```
celest/
├── src/                          # VS Code 扩展后端 (TypeScript)
│   ├── extension.ts              # 入口：activate() + 命令注册
│   ├── chatViewProvider.ts       # WebView 面板生命周期 + 消息路由
│   ├── sessionsTreeProvider.ts   # 会话列表 TreeView
│   ├── tuiProcessManager.ts      # codewhale-tui 子进程管理 + HTTP/SSE
│   ├── secretStorage.ts          # VS Code SecretStorage 封装 (API Key)
│   └── binaryDownloader.ts       # GitHub Release 二进制下载
│
├── gui/                          # 前端 GUI (Vue 3 + Vite)
│   ├── src/
│   │   ├── main.ts               # Vue 挂载点
│   │   ├── App.vue               # 根组件（布局 + 消息路由）
│   │   ├── i18n.ts               # 国际化模块 (zh-CN / en)
│   │   └── components/
│   │       ├── ChatView.vue      # 聊天消息列表（流式渲染）
│   │       ├── InputBox.vue      # 输入框（@ / 检测）
│   │       ├── MarkdownRenderer.vue  # Markdown 渲染
│   │       ├── ThinkingBlock.vue # Thinking 块折叠
│   │       ├── ContextBar.vue    # 底部信息栏（模型/模式/轮次）
│   │       ├── SettingsPanel.vue # 设置面板（通用/模型/关于）
│   │       ├── ApprovalPopup.vue # 审批弹窗（Phase 4）
│   │       ├── WorkPanel.vue     # Work 面板
│   │       ├── PlanPanel.vue     # Plan 面板
│   │       ├── TasksPanel.vue    # Tasks 面板
│   │       └── HelpPanel.vue     # 帮助面板
│   ├── index.html                # HTML 入口
│   ├── vite.config.ts            # Vite 构建配置
│   └── tsconfig.json             # GUI TypeScript 配置
│
├── docs/                         # 文档
│   ├── PLAN.md                   # 开发计划
│   ├── INTEGRATION_TEST.md       # 集成测试用例
│   └── TEST_PLAN.md              # 测试方案
├── assets/                       # 品牌资源
│   └── icon.svg                  # Celest 月亮 Logo
├── build.mjs                     # 一键构建脚本
├── vitest.config.ts              # 测试配置
├── .github/workflows/ci.yml      # CI 流水线
├── AGENTS.md                     # AI 代码审查规则
├── ARCHITECTURE.md               # 本文件
└── README.md                     # 项目说明
```

## 通信协议

```
Extension Host ←→ WebView:
  双向 postMessage (VS Code Webview API)
  消息类型: sendPrompt / addContext / approvalDecision / openSettings / getSettings
           / saveSettings / switchModel / switchMode / downloadBinary / browseBinary

Extension Host ←→ CodeWhale TUI:
  HTTP/SSE (codewhale-tui serve --http --port X --host 127.0.0.1 --insecure)
  GET  /health                        → 健康检查
  GET  /v1/threads                    → 线程列表
  POST /v1/threads                    → 创建线程 (model, mode, auto_approve)
  POST /v1/threads/{id}/turns         → 发送 prompt
  GET  /v1/threads/{id}/events        → SSE 事件流 (reasoning, text, tool, approval)
  PATCH /v1/threads/{id}              → 更新线程配置 (model, mode)
  POST /v1/approvals/{id}             → 审批决策 (allow/deny)
  GET  /v1/tasks                      → 任务列表
  GET  /v1/runtime/info               → 运行时信息 (version)
```

## 开发阶段

| Phase | 内容 | 状态 |
|-------|------|------|
| 0 | 骨架：构建链 + 品牌 + CI | ✅ |
| 1 | 进程通信 + JSON-RPC + 单元测试 | ✅ |
| 2 | 聊天核心 + 流式输出 + 工具步骤 | ✅ |
| 3 | @ / 命令 + 任务面板 + 计划面板 | ✅ |
| 4 | 审批弹窗 + Shell 实时输出 + Diff | ✅ |
| 5 | 设置面板 + 模型/模式切换 + API Key + i18n + 二进制下载 | ✅ |
| 6 | 打包发布 + Marketplace | ⏳ |
| 6.1 | Skills API + 工作区状态 + 用量统计 | ✅ |
| 6.2 | 会话管理 + 线程详情 + 后台任务 | ✅ |
| 6.3 | Automations 自动化任务 + 子代理事件 | ✅ |
| 7 | Provider 生态同步 (v0.8.53) + 命名统一 | ✅ |

## CodeWhale 迁移 (v0.8.40 → v0.8.44+)

| 项目 | 旧 | 新 |
|------|-----|-----|
| 二进制 | `deepseek-tui` | `codewhale-tui` |
| 启动命令 | `serve --http --port X --host Y --insecure` | 不变 |
| 默认端口 | 7878 | 8787 |
| 仓库 | `deepseek-ai/DeepSeek-TUI` | `Hmbown/CodeWhale` |
| HTTP API | 不变 | 不变 |
| 当前 TUI 版本 | v0.8.44 | v0.8.53 |
| 会话文件 | `~/.deepseek/` | `~/.codewhale/` (兼容读取旧路径) |
