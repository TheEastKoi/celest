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
│  │  ├── ThinkingBlock.vue│   │  ├── tuiProcessManager.ts   │  │
│  │  ├── ContextBar.vue  │◄──┤  └── jsonRpcClient.ts        │  │
│  │  └── MarkdownR...vue │   │                              │  │
│  └─────────────────────┘   └──────────┬───────────────────┘  │
│         postMessage()                  │ spawn + stdio       │
└────────────────────────────────────────┼────────────────────┘
                                         │
                              ┌──────────▼──────────────────┐
                              │  deepseek-tui (Rust binary)  │
                              │  - Agent 循环 (turn_loop)    │
                              │  - 工具系统 (78+ tools)      │
                              │  - 权限引擎 (ExecPolicy)     │
                              │  - 会话持久化 (SQLite)       │
                              │  - 子代理管理                │
                              └─────────────────────────────┘
```

## 模块清单

```
celest/
├── src/                          # VS Code 扩展后端 (TypeScript)
│   ├── extension.ts              # 入口：activate() + 命令注册
│   ├── chatViewProvider.ts       # WebView 面板生命周期
│   ├── sessionsTreeProvider.ts   # 会话列表 TreeView
│   ├── tuiProcessManager.ts      # deepseek-tui 子进程管理
│   ├── jsonRpcClient.ts          # JSON-RPC 客户端 (Phase 1)
│   └── protocol.ts               # 协议类型定义 (Phase 1)
│
├── gui/                          # 前端 GUI (Vue 3 + Vite)
│   ├── src/
│   │   ├── main.ts               # Vue 挂载点
│   │   ├── App.vue               # 根组件（布局框架）
│   │   └── components/
│   │       ├── ChatView.vue      # 聊天消息列表
│   │       ├── InputBox.vue      # 输入框（@ / 检测）
│   │       ├── MarkdownRenderer.vue  # Markdown 渲染
│   │       ├── ThinkingBlock.vue # Thinking 块折叠
│   │       └── ContextBar.vue    # 底部信息栏
│   ├── index.html                # HTML 入口
│   ├── vite.config.ts            # Vite 构建配置
│   └── tsconfig.json             # GUI TypeScript 配置
│
├── test/                         # 集成测试 (Phase 1)
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
  消息类型: sendPrompt / addContext / approvalDecision / showHistory / focusInput

Extension Host ←→ deepseek-tui:
  JSON-RPC 2.0 over stdin/stdout
  请求: {"jsonrpc":"2.0","id":1,"method":"thread/list","params":{}}
  响应: {"jsonrpc":"2.0","id":1,"result":{...}}
  通知: {"jsonrpc":"2.0","method":"event","params":{...}}
```

## 开发阶段

| Phase | 内容 | 预计 |
|-------|------|------|
| 0 | 骨架：构建链 + 品牌 + CI ✅ | 2天 |
| 1 | 进程通信 + JSON-RPC + 单元测试 | 2天 |
| 2 | 聊天核心 + 流式输出 + 工具步骤 | 3天 |
| 3 | @ / 命令 + 任务面板 + 计划面板 | 2天 |
| 4 | 审批弹窗 + Shell 实时输出 + Diff | 2天 |
| 5 | 设置面板 + 模型切换 + 二进制下载 | 2天 |
| 6 | 打包发布 + Marketplace | 2天 |
