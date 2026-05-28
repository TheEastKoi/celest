<p align="center">
  <img src="assets/icon.svg" width="96" alt="Celest">
</p>

<h1 align="center">Celest — DeepSeek AI Agent for VS Code</h1>

<p align="center">
  <strong>免费 · 直连 DeepSeek API · 基于 CodeWhale 引擎</strong><br>
  在 VS Code 中拥有完整 AI 编程助手 — 流式对话 · 工具执行 · 多面板 · 全免费
</p>

<p align="center">
  <a href="README.en.md">English</a> | 简体中文
</p>

---

## 为什么选择 Celest？

| | Celest | 其他插件 |
|---|:---:|:---:|
| 💰 价格 | **完全免费** | 付费订阅 |
| 🔗 连接方式 | **直连 DeepSeek API** | 中转服务器 |
| 🧠 后台引擎 | **CodeWhale TUI** (Rust) | 自研/闭源 |
| 🔧 工具执行 | **全量 37 API** | 有限 |
| 📊 右侧面板 | **7 个实时面板** | 1-2 个 |
| 🎯 审批流程 | **Agent/Plan/YOLO** 可切换 | 无 |
| 📁 文件引用 | **@[路径] 彩色标签** | 纯文本 |

---

## ✨ 功能一览

| 功能 | 说明 |
|------|------|
| 💬 流式对话 | HTTP/SSE 原生流式，逐 token 渲染 |
| 🧠 Thinking | reasoning 实时流，折叠可展开 |
| 🔧 工具执行 | 工具卡片（折叠/状态/结果预览/View Diff） |
| 📋 Work 面板 | 任务清单 + 计划进度，自动解析 |
| 📌 Tasks 面板 | 后台任务状态实时跟踪 |
| 🤖 Agents 面板 | 子代理状态实时跟踪 |
| 📊 Context 面板 | Token 用量 + Git 状态 + MCP 计数 |
| 🧩 Skills 面板 | TUI 技能启用/禁用管理 |
| 📈 Usage 面板 | 用量统计，按天/模型/线程分组 |
| 📁 @ 提及 | 工作区文件自动补全 + 彩色类型标签 |
| ⚡ / 命令 | 57 个斜杠命令，中文别名，列对齐弹窗 |
| ❓ Help 面板 | 命令 + 快捷键参考 |
| 📂 会话管理 | TreeView 会话列表 + 标题 + 删除 |
| 🔐 审批弹窗 | 工具执行确认，低影响自动批准 |
| ⚙ 设置面板 | API Key 安全存储 + 模型切换 + i18n |
| 🗜 上下文压缩 | /compact 命令 + 按钮，减少 token |
| ⏹ Stop 打断 | 中断当前生成 + async interrupt |
| 🌐 国际化 | 简体中文 / English |
| 📥 自动下载 | codewhale-tui 一键下载 + 更新 |

---

## 📸 截图

<p align="center">
  <img src="docs/screenshot.png" alt="Celest 完整界面" width="800">
  <br><em>完整工作界面 — 聊天 + 7 个右侧面板 + Sessions + 文件标签</em>
</p>

<details>
<summary>⚙ 设置面板</summary>
<p align="center">
  <img src="docs/settings-general.png" alt="通用设置" width="400">
  <img src="docs/settings-model.png" alt="模型设置" width="400">
  <img src="docs/settings-about.png" alt="关于" width="400">
</p>
</details>

---

## 📦 安装

### 前置条件

- **VS Code** ≥ 1.70.0
- **Node.js** ≥ 18
- **DeepSeek API Key** ([免费获取](https://platform.deepseek.com))

### 快速开始

```bash
git clone https://github.com/TheEastKoi/celest.git
cd celest
npm install
npm run build
```

VS Code 按 `F5` 启动，或：

```bash
npx vsce package
code --install-extension celest-*.vsix
```

打开 Celest 面板 → 设置 API Key → 开始使用。

---

## 🚀 使用

| 操作 | 方式 |
|------|------|
| 发送消息 | `Enter` |
| 提及文件 | `@` → 弹窗选择 |
| 浏览命令 | `/` → 弹窗选择 |
| 新建会话 | 顶栏 `＋` |
| 压缩上下文 | 顶栏 `🗜` 或 `/compact` |
| 切换模型 | 底部栏下拉框 |
| 切换模式 | 底部栏 `Agent/Plan/YOLO` |
| 打开设置 | 顶栏 `⚙` |

---

## 🏗️ 架构

```
VS Code WebView (Vue 3)  ←→  Extension Host (Node.js)  ←→  CodeWhale TUI (Rust)
      前端界面                   消息路由+进程管理              AI引擎+工具执行
```

- **前端**: Vue 3 + Vite + markdown-it + highlight.js
- **后端**: TypeScript, VS Code Extension API, HTTP/SSE
- **引擎**: [CodeWhale TUI](https://github.com/Hmbown/CodeWhale) (Rust), 37 个 Runtime API
- **直连**: 不走任何中转服务器，API Key 本地安全存储

---

## 📄 许可

Apache-2.0

---

<p align="center">
  <sub>Made with 🌙 by <a href="https://github.com/TheEastKoi">TheEastKoi</a></sub>
</p>
