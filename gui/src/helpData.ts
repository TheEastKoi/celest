// Celest Help 面板数据 — 与 DeepSeek TUI 0.8.40 的 64 命令和 43 快捷键完全对齐

export interface HelpCmd {
    names: string[];
    desc: string;
    usage: string;
}

export interface HelpSection {
    title: string;
    color: string;
    commands: HelpCmd[];
}

export function getHelpSections(): HelpSection[] {
    return [
        // ── 7 Keybinding sections ──
        {
            title: '⌨️ Keybindings — Navigation 导航',
            color: '#60a5fa',
            commands: [
                { names: ['↑ / ↓'], desc: 'Scroll transcript / 滚动对话', usage: '' },
                { names: ['Ctrl+↑ / Ctrl+↓'], desc: 'Navigate history / 浏览历史', usage: '' },
                { names: ['Alt+↑ / Alt+↓'], desc: 'Fast scroll / 快速滚动', usage: '' },
                { names: ['Shift+↑ / Shift+↓'], desc: 'Browse history / 历史浏览', usage: '' },
                { names: ['PgUp / PgDn'], desc: 'Scroll page / 翻页', usage: '' },
                { names: ['Ctrl+Home', 'Ctrl+End'], desc: 'Jump top/bottom / 跳转首尾', usage: '' },
                { names: ['g', 'G'], desc: 'Jump top/bottom (empty) / 跳转首尾', usage: '' },
                { names: ['[', ']'], desc: 'Jump tool blocks / 跳转工具块', usage: '' },
            ],
        },
        {
            title: '⌨️ Keybindings — Editing 编辑',
            color: '#34d399',
            commands: [
                { names: ['← / →'], desc: 'Move cursor / 移动光标', usage: '' },
                { names: ['Home', 'End'], desc: 'Line start/end / 行首尾', usage: '' },
                { names: ['Ctrl+A', 'Ctrl+E'], desc: 'Line start/end / 行首尾', usage: '' },
                { names: ['Backspace', 'Delete'], desc: 'Delete char / 删除字符', usage: '' },
                { names: ['Ctrl+U'], desc: 'Clear draft / 清空草稿', usage: '' },
                { names: ['Ctrl+S'], desc: 'Stash draft / 暂存草稿', usage: '' },
                { names: ['Alt+R'], desc: 'Search history / 搜索历史', usage: '' },
                { names: ['Ctrl+J', 'Alt+Enter', 'Shift+Enter'], desc: 'New line / 换行', usage: '' },
            ],
        },
        {
            title: '⌨️ Keybindings — Submission 提交',
            color: '#fbbf24',
            commands: [
                { names: ['Enter'], desc: 'Send draft / 发送', usage: '' },
                { names: ['Esc'], desc: 'Close menu / 关闭菜单', usage: '' },
                { names: ['Ctrl+C'], desc: 'Cancel/Exit / 取消/退出', usage: '' },
                { names: ['Ctrl+B'], desc: 'Shell controls / 终端控制', usage: '' },
                { names: ['Ctrl+D'], desc: 'Exit when empty / 空输入退出', usage: '' },
                { names: ['Ctrl+K'], desc: 'Command palette / 命令面板', usage: '' },
                { names: ['Ctrl+P'], desc: 'File picker / 文件选择', usage: '' },
                { names: ['Alt+C'], desc: 'Compact inspector / 压缩检查', usage: '' },
                { names: ['l'], desc: 'Last message pager / 上条消息', usage: '' },
                { names: ['v'], desc: 'Selected details / 详情', usage: '' },
                { names: ['Alt+V'], desc: 'Tool details / 工具详情', usage: '' },
                { names: ['Ctrl+O'], desc: 'Activity Detail / 活动详情', usage: '' },
                { names: ['Ctrl+T'], desc: 'Live transcript / 实时记录', usage: '' },
                { names: ['Esc', 'Esc'], desc: 'Backtrack / 回退消息', usage: '' },
            ],
        },
        {
            title: '⌨️ Keybindings — Modes 模式',
            color: '#f472b6',
            commands: [
                { names: ['Tab', 'Shift+Tab'], desc: 'Cycle modes / 切换模式', usage: '' },
                { names: ['Alt+1', 'Alt+2', 'Alt+3'], desc: 'Plan/Agent/Yolo / 模式切换', usage: '' },
                { names: ['Alt+P', 'Alt+A', 'Alt+Y'], desc: 'Plan/Agent/Yolo / 模式切换', usage: '' },
                { names: ['Alt+!', 'Alt+@', 'Alt+#', 'Alt+$', 'Alt+0'], desc: 'Focus sidebar / 侧边栏', usage: '' },
                { names: ['Ctrl+X'], desc: 'Toggle Plan/Agent / 计划/代理', usage: '' },
            ],
        },
        {
            title: '⌨️ Keybindings — Sessions 会话',
            color: '#a78bfa',
            commands: [
                { names: ['Ctrl+R'], desc: 'Session picker / 会话选择', usage: '' },
            ],
        },
        {
            title: '⌨️ Keybindings — Clipboard 剪贴板',
            color: '#38bdf8',
            commands: [
                { names: ['Ctrl+V'], desc: 'Paste & attach / 粘贴附加', usage: '' },
                { names: ['Ctrl+Shift+C'], desc: 'Copy selection / 复制选中', usage: '' },
                { names: ['Right click'], desc: 'Context menu / 右键菜单', usage: '' },
                { names: ['@path'], desc: 'Attach path / 附加路径', usage: '' },
            ],
        },
        {
            title: '⌨️ Keybindings — Help 帮助',
            color: '#fb923c',
            commands: [
                { names: ['?'], desc: 'Help overlay / 帮助', usage: '' },
                { names: ['F1'], desc: 'Toggle help / 切换帮助', usage: '' },
                { names: ['Ctrl+/'], desc: 'Toggle help / 切换帮助', usage: '' },
            ],
        },

        // ── 8 Command category sections (64 commands from TUI COMMANDS registry) ──
        {
            title: 'Core 核心 (16 commands)',
            color: '#60a5fa',
            commands: [
                { names: ['help', '?', 'bangzhu', '帮助'], desc: 'Show this help overlay / 显示帮助', usage: '/help [cmd]' },
                { names: ['clear', 'qingping'], desc: 'Clear current conversation / 清屏', usage: '/clear' },
                { names: ['exit', 'quit', 'q', 'tuichu'], desc: 'Exit the TUI (CLI mode only) / 退出', usage: '/exit' },
                { names: ['model', 'moxing'], desc: 'Switch or list AI models / 切换模型', usage: '/model [name]' },
                { names: ['models', 'moxingliebiao'], desc: 'List available models / 模型列表', usage: '/models' },
                { names: ['provider'], desc: 'Switch or view the active LLM backend / 切换供应商', usage: '/provider [name]' },
                { names: ['workspace', 'cwd'], desc: 'Show or switch workspace / 工作区', usage: '/workspace [path]' },
                { names: ['links', 'dashboard', 'api', 'lianjie'], desc: 'Open dashboard & API links / 链接', usage: '/links' },
                { names: ['home', 'stats', 'overview', 'zhuye', 'shouye'], desc: 'Home dashboard / 首页', usage: '/home' },
                { names: ['anchor', 'maodian'], desc: 'Pin a fact that survives compaction / 锚点', usage: '/anchor <text>' },
                { names: ['attach', 'image', 'media', 'fujian'], desc: 'Attach image/video media / 附加文件', usage: '/attach <path>' },
                { names: ['agent', 'daili'], desc: 'Open a persistent sub-agent session / 子代理', usage: '/agent [N] <task>' },
                { names: ['subagents', 'agents', 'zhinengti'], desc: 'Sub-agent status / 子代理状态', usage: '/subagents' },
                { names: ['queue', 'queued'], desc: 'Manage queued prompts / 队列', usage: '/queue [list|edit|drop|clear]' },
                { names: ['stash', 'park'], desc: 'Park or restore a composer draft / 暂存', usage: '/stash [list|pop|clear]' },
                { names: ['hooks', 'hook', 'gouzi'], desc: 'Manage hooks / 钩子', usage: '/hooks [list|events]' },
            ],
        },
        {
            title: 'Session 会话 (11 commands)',
            color: '#34d399',
            commands: [
                { names: ['compact', 'yasuo'], desc: 'Trigger context compaction / 压缩上下文', usage: '/compact' },
                { names: ['rename', 'gaiming', 'chongmingming'], desc: 'Rename current session / 重命名', usage: '/rename <title>' },
                { names: ['save'], desc: 'Save session to disk / 保存', usage: '/save [path]' },
                { names: ['load', 'jiazai'], desc: 'Load a saved session / 加载', usage: '/load [path]' },
                { names: ['fork', 'branch'], desc: 'Fork current session / 分支', usage: '/fork' },
                { names: ['export', 'daochu'], desc: 'Export session as markdown / 导出', usage: '/export [path]' },
                { names: ['sessions', 'resume'], desc: 'List or resume sessions / 会话列表', usage: '/sessions [show|prune]' },
                { names: ['relay', 'batonpass', '接力'], desc: 'Relay to a fresh agent / 接力', usage: '/relay [focus]' },
                { names: ['recall'], desc: 'Search compressed context archives / 回忆', usage: '/recall <query>' },
                { names: ['cycles', 'zhouqi'], desc: 'Compression cycles / 压缩周期', usage: '/cycles' },
                { names: ['cycle'], desc: 'Show a specific compression cycle / 指定周期', usage: '/cycle <n>' },
            ],
        },
        {
            title: 'Config 配置 (8 commands)',
            color: '#fbbf24',
            commands: [
                { names: ['config'], desc: 'Open config file or show settings / 配置', usage: '/config' },
                { names: ['settings'], desc: 'Show settings / 设置', usage: '/settings' },
                { names: ['mode', 'jihua', 'zidong'], desc: 'Switch mode: agent|plan|yolo|1|2|3 / 切换模式', usage: '/mode [agent|plan|yolo]' },
                { names: ['theme'], desc: 'Switch theme / 主题', usage: '/theme [name]' },
                { names: ['verbose'], desc: 'Toggle verbose output / 详细模式', usage: '/verbose [on|off]' },
                { names: ['trust', 'xinren'], desc: 'Manage workspace trust allowlist / 信任目录', usage: '/trust [on|off|add|list]' },
                { names: ['logout'], desc: 'Log out current provider / 登出', usage: '/logout' },
                { names: ['statusline'], desc: 'Toggle status line / 状态栏', usage: '/statusline' },
            ],
        },
        {
            title: 'Debug 调试 (11 commands)',
            color: '#f472b6',
            commands: [
                { names: ['context', 'ctx'], desc: 'Show context window usage / 上下文使用', usage: '/context' },
                { names: ['tokens'], desc: 'Token counts for current turn / Token统计', usage: '/tokens' },
                { names: ['cost'], desc: 'Cost estimate for current session / 费用估算', usage: '/cost' },
                { names: ['cache'], desc: 'Prefix-cache hit/miss stats / 缓存统计', usage: '/cache [count|inspect|warmup]' },
                { names: ['system', 'xitong'], desc: 'Show system prompt / 系统提示', usage: '/system' },
                { names: ['diff'], desc: 'Show latest file diff / 差异', usage: '/diff' },
                { names: ['undo'], desc: 'Undo last tool-applied file change / 撤销', usage: '/undo' },
                { names: ['retry', 'chongshi'], desc: 'Retry last turn / 重试', usage: '/retry' },
                { names: ['edit'], desc: 'Open last edited file / 编辑', usage: '/edit' },
                { names: ['change'], desc: 'Changelog / 变更日志', usage: '/change [version]' },
                { names: ['translate', 'translation', 'transale'], desc: 'Toggle output translation / 翻译', usage: '/translate' },
            ],
        },
        {
            title: 'Tools 工具 (8 commands)',
            color: '#a78bfa',
            commands: [
                { names: ['mcp'], desc: 'Manage MCP servers / MCP服务', usage: '/mcp [init|add|enable|disable]' },
                { names: ['network'], desc: 'Network permission management / 网络权限', usage: '/network [list|allow|deny]' },
                { names: ['lsp'], desc: 'LSP integration toggle / LSP集成', usage: '/lsp [on|off|status]' },
                { names: ['note'], desc: 'Persistent notes across sessions / 笔记', usage: '/note [add|list|show|edit]' },
                { names: ['memory'], desc: 'Agent memory management / 记忆', usage: '/memory [show|edit|clear]' },
                { names: ['task', 'tasks'], desc: 'Background tasks / 后台任务', usage: '/task [add|list|show|cancel]' },
                { names: ['jobs', 'job', 'zuoye'], desc: 'Background jobs / 后台作业', usage: '/jobs [list|show|poll|cancel]' },
                { names: ['review', 'shencha'], desc: 'Review code changes in workspace / 代码审查', usage: '/review <target>' },
            ],
        },
        {
            title: 'Project 项目 (5 commands)',
            color: '#38bdf8',
            commands: [
                { names: ['init'], desc: 'Initialize project instructions / 项目初始化', usage: '/init' },
                { names: ['share'], desc: 'Share session as markdown / 分享', usage: '/share' },
                { names: ['goal', 'mubiao'], desc: 'Set session goal with budget / 目标', usage: '/goal [objective] [budget: N]' },
                { names: ['feedback'], desc: 'Submit feedback: bug|feature|security / 反馈', usage: '/feedback [bug|feature]' },
                { names: ['profile', 'dangan'], desc: 'Switch configuration profile / 配置文件', usage: '/profile <name>' },
            ],
        },
        {
            title: 'Skills 技能 (2 commands)',
            color: '#fb923c',
            commands: [
                { names: ['skills', 'jinengliebiao'], desc: 'List local skills / 技能列表', usage: '/skills [--remote|sync|<prefix>]' },
                { names: ['skill', 'jineng'], desc: 'Activate/install/update/uninstall a skill / 技能', usage: '/skill <name|install|update|uninstall>' },
            ],
        },
        {
            title: 'Other 其他 (3 commands)',
            color: '#4ade80',
            commands: [
                { names: ['status'], desc: 'Show runtime status / 运行状态', usage: '/status' },
                { names: ['restore'], desc: 'Roll back workspace to prior snapshot / 恢复', usage: '/restore [N]' },
                { names: ['rlm', 'recursive', 'digui'], desc: 'Run recursive language model / 递归语言模型', usage: '/rlm [N] <file_or_text>' },
            ],
        },
    ];
}
