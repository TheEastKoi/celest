# Celest — DeepSeek V4 AI Coding Agent for VS Code

**Celest** 是一个 VS Code 插件，将 [DeepSeek TUI](https://github.com/Hmbown/DeepSeek-TUI) 强大的 AI Agent 能力带入 VS Code。

## 架构

```
┌──────────────────────────────────────────┐
│  VS Code Extension (Celest)               │
│  ┌────────────┐  ┌──────────────────────┐│
│  │ WebView GUI│  │ Extension Host       ││
│  │ (React)    │  │ - 命令注册            ││
│  │            │  │ - JSON-RPC 客户端     ││
│  └────────────┘  │ - 进程管理            ││
│                  └──────────┬───────────┘│
│                             │ stdio       │
│                  ┌──────────▼───────────┐│
│                  │ deepseek-tui (Rust)   ││
│                  │ - Agent 循环          ││
│                  │ - 工具系统            ││
│                  │ - 权限引擎            ││
│                  └──────────────────────┘│
└──────────────────────────────────────────┘
```

## 开发

```bash
cd celest
npm install
npm run build
# F5 in VS Code to launch Extension Development Host
```

## 发布

```bash
npm run build
npm run package
```

## 许可

Apache-2.0
