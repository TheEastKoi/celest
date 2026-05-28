<p align="center">
  <img src="assets/icon.svg" width="96" alt="Celest">
</p>

<h1 align="center">Celest — DeepSeek AI Agent for VS Code</h1>

<p align="center">
  <strong>Free · Direct DeepSeek API · Powered by CodeWhale Engine</strong><br>
  Full AI coding assistant in VS Code — Streaming chat · Tool execution · Multi-panel · 100% Free
</p>

<p align="center">
  <a href="README.md">简体中文</a> | English
</p>

---

## Why Celest?

| | Celest | Others |
|---|:---:|:---:|
| 💰 Price | **Completely Free** | Paid subscription |
| 🔗 Connection | **Direct to DeepSeek API** | Proxy server |
| 🧠 Engine | **CodeWhale TUI** (Rust) | Proprietary |
| 🔧 Tool Execution | **All 37 APIs** | Limited |
| 📊 Panels | **7 real-time panels** | 1-2 |
| 🎯 Approval Modes | **Agent/Plan/YOLO** switchable | None |
| 📁 File References | **@[path] colored chips** | Plain text |

---

## ✨ Features

| Feature | Description |
|------|------|
| 💬 Streaming Chat | HTTP/SSE native streaming, token-by-token |
| 🧠 Thinking | Real-time reasoning stream, collapsible |
| 🔧 Tool Execution | Tool cards (collapse/status/result/View Diff) |
| 📋 Work Panel | Task checklist + plan progress, auto-parsed |
| 📌 Tasks Panel | Background task real-time tracking |
| 🤖 Agents Panel | Sub-agent status tracking |
| 📊 Context Panel | Token usage + Git status + MCP count |
| 🧩 Skills Panel | TUI skills enable/disable management |
| 📈 Usage Panel | Usage stats by day/model/thread |
| 🖼️ Image OCR | Screenshot paste + text extraction (requires Tesseract) |
| 📁 @ Mentions | Workspace file autocomplete + colored type chips |
| ⚡ / Commands | 57 slash commands, Chinese aliases, aligned popup |
| ❓ Help Panel | Commands + shortcuts reference |
| 📂 Session Management | TreeView session list + title + delete |
| 🔐 Approval Popup | Tool execution confirm, low-impact auto-approve |
| ⚙ Settings Panel | Secure API Key storage + model switch + i18n |
| 🗜 Context Compaction | /compact command + button to reduce tokens |
| ⏹ Stop & Interrupt | Cancel generation + async interrupt |
| 🌐 i18n | Simplified Chinese / English |
| 📥 Auto Download | codewhale-tui one-click install + update |

---

## 📸 Screenshots

<p align="center">
  <img src="docs/screenshot.png" alt="Celest Full UI" width="800">
  <br><em>Full workspace — Chat + 7 panels + Sessions + File chips</em>
</p>

<details>
<summary>⚙ Settings Panel</summary>
<p align="center">
  <img src="docs/settings-general.png" alt="General Settings" width="400">
  <img src="docs/settings-model.png" alt="Model Settings" width="400">
  <img src="docs/settings-about.png" alt="About" width="400">
</p>
</details>

---

## 📦 Installation

### Prerequisites

- **VS Code** ≥ 1.70.0
- **Node.js** ≥ 18
- **DeepSeek API Key** ([Get free key](https://platform.deepseek.com))

### Quick Start

```bash
git clone https://github.com/TheEastKoi/celest.git
cd celest
npm install
npm run build
```

Press `F5` in VS Code, or:

```bash
npx vsce package
code --install-extension celest-*.vsix
```

Open Celest panel → Set API Key → Start chatting.

---

## 🚀 Usage

### Basic Operations

| Action | How |
|------|------|
| Send message | `Enter` |
| New line | `Shift+Enter` |
| Stop generation | Click `⏹ Stop` |
| New session | Top bar `＋` |
| Compact context | Top bar `🗜` or type `/compact` |
| Clear chat | Type `/clear` |
| Open help | Type `/help` |

### File References

- **`@` Popup** — Type `@` → search and select workspace files
- **`Ctrl+Shift+L`** — Select file in Explorer → shortcut to add
- **Paste path** — Copy file path & paste → auto-formatted as `@[path]`
- **File chips** — `@[path]` rendered as colored type chips in chat, hover for path, click to open
- **Image OCR** — Paste images for AI to read text (requires [Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki), check Settings → About)

### Commands

- **`/` Popup** — Type `/` → browse 57 commands (supports Chinese search)
- **Common**: `/clear` `/compact` `/help` `/model` `/mode` `/doctor` `/context`

### Model & Mode

- **Model switch** — Bottom bar dropdown (V4 Pro / V4 Flash etc.)
- **Mode cycle** — Bottom bar click Mode: Agent (approval) → Plan → YOLO (auto-execute)
- **Approval** — Agent mode shows confirm popup before tool execution, low-impact tools auto-approved

---

## 🏗️ Project Structure

```
celest/
├── src/                          # Extension backend (TypeScript)
│   ├── extension.ts              # Entry: command registration + views
│   ├── chatViewProvider.ts       # WebView management + message routing
│   ├── tuiProcessManager.ts      # TUI process + HTTP/SSE 37 APIs
│   ├── sessionsTreeProvider.ts   # Session TreeView
│   ├── secretStorage.ts          # API Key secure storage
│   ├── binaryDownloader.ts       # GitHub Release binary download
│   └── logger.ts                 # Unified logging
├── gui/src/                      # Frontend UI (Vue 3)
│   ├── App.vue                   # Root layout + split + approval
│   ├── i18n.ts                   # i18n (zh-CN / en)
│   ├── helpData.ts               # 57 commands + 5 shortcuts data
│   ├── global.css                # Global styles + file chips
│   └── components/
│       ├── ChatView.vue          # Message list + streaming
│       ├── InputBox.vue          # Input + @mention + /command
│       ├── MarkdownRenderer.vue  # Markdown rendering (highlight.js)
│       ├── ThinkingBlock.vue     # Thinking collapsible block
│       ├── ContextBar.vue        # Bottom bar (model/mode/Git)
│       ├── SettingsPanel.vue     # Settings (General/Model/About)
│       ├── ApprovalPopup.vue     # Approval popup
│       ├── WorkPanel.vue         # Work panel (tasks + plan)
│       ├── TasksPanel.vue        # Tasks panel
│       ├── AgentsPanel.vue       # Agents panel
│       ├── ContextPanel.vue      # Context panel
│       ├── SkillsPanel.vue       # Skills panel
│       ├── UsagePanel.vue        # Usage panel
│       ├── HelpPanel.vue         # Help panel
│       ├── AtMentionPopup.vue    # @ file popup
│       └── SlashCommandPopup.vue # / command popup
├── docs/
│   ├── PLAN.md                   # Development plan
│   ├── INTEGRATION_TEST.md       # Integration test manual
│   ├── CHANGELOG.md              # Changelog
│   └── BUGLOG.md                 # Bug tracking
├── build.mjs                     # esbuild script
└── package.json
```

## 🔧 Development

```bash
cd celest
npm install

# Build
node build.mjs

# Test
npx vitest run

# F5 to debug
```

## 📋 Development Phases

| Phase | Content | Status |
|-------|------|:----:|
| 0 | Project skeleton | ✅ |
| 1 | TUI communication + Vue GUI | ✅ |
| 2 | Chat core (HTTP/SSE) | ✅ |
| 3 | @ / / panels + session list | ✅ |
| 4 | Approval + execution + Diff | ✅ |
| 5 | Settings + model/mode + i18n + download | ✅ |
| 6 | Full API adaptation + panel alignment + tests | ✅ |
| 6.4 | Closed beta fixes (26 bugs + 10 features) | ✅ |

## 🔄 Backend Engine

Celest is powered by [CodeWhale TUI](https://github.com/Hmbown/CodeWhale), communicating via HTTP/SSE with all 37 Runtime APIs. The TUI process is auto-managed (start/restart/update) — no manual setup required.

| Item | Detail |
|------|------|
| Engine | CodeWhale TUI v0.8.46 (Rust) |
| Protocol | HTTP/SSE (localhost:8787) |
| API Coverage | 37/37 (100%) |
| Auto-download | GitHub Release → one-click install |

---

## 📄 License

Apache-2.0

---

<p align="center">
  <sub>Made with 🌙 by <a href="https://github.com/TheEastKoi">TheEastKoi</a></sub>
</p>
