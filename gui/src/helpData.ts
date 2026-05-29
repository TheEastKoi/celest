// Celest Slash Commands — VS Code 插件可用命令（对齐 TUI v0.8.46）
// 仅排除纯 TUI-UI 命令（/statusline /view /add-dir /welcome /verbose），其余全部可用

export interface SlashCommand {
    name: string;
    zhName: string;
    description: string;
    category: string;
}

/** 斜杠命令 — / 弹窗 + /help 面板共用 */
export const SLASH_COMMANDS: SlashCommand[] = [
    // ── Core 核心 (14) ──
    { name: 'clear',       zhName: '清屏',   description: 'Clear chat display',                              category: 'core' },
    { name: 'compact',     zhName: '压缩',   description: 'Compact context (reduce tokens)',                  category: 'core' },
    { name: 'help',        zhName: '帮助',   description: 'Show help panel',                                  category: 'core' },
    { name: 'model',       zhName: '模型',   description: 'Switch AI model',                                  category: 'core' },
    { name: 'models',      zhName: '模型列表', description: 'List available models',                          category: 'core' },
    { name: 'mode',        zhName: '模式',   description: 'Switch mode (agent/plan/yolo)',                    category: 'core' },
    { name: 'provider',    zhName: '供应商', description: 'Switch API provider',                              category: 'core' },
    { name: 'doctor',      zhName: '诊断',   description: 'Run TUI health check',                             category: 'core' },
    { name: 'version',     zhName: '版本',   description: 'Show TUI version',                                 category: 'core' },
    { name: 'agent',       zhName: '子代理', description: 'Manage sub-agents',                                category: 'core' },
    { name: 'config',      zhName: '配置',   description: 'Show / edit runtime config',                       category: 'core' },
    { name: 'links',       zhName: '链接',   description: 'Dashboard & API links',                            category: 'core' },
    { name: 'stash',       zhName: '暂存',   description: 'Stash current session',                            category: 'core' },
    { name: 'queue',       zhName: '队列',   description: 'Show queued prompts',                              category: 'core' },

    // ── Session 会话 (13) ──
    { name: 'rename',      zhName: '重命名', description: 'Rename current session',                           category: 'session' },
    { name: 'fork',        zhName: '分支',   description: 'Fork current session',                             category: 'session' },
    { name: 'new',         zhName: '新会话', description: 'Start a fresh session',                            category: 'session' },
    { name: 'load',        zhName: '加载',   description: 'Load a saved session',                             category: 'session' },
    { name: 'save',        zhName: '保存',   description: 'Save current session',                             category: 'session' },
    { name: 'sessions',    zhName: '会话',   description: 'List / resume sessions',                           category: 'session' },
    { name: 'export',      zhName: '导出',   description: 'Export session as markdown',                       category: 'session' },
    { name: 'share',       zhName: '分享',   description: 'Share session as markdown',                        category: 'session' },
    { name: 'init',        zhName: '初始化', description: 'Initialize project instructions',                   category: 'session' },
    { name: 'goal',        zhName: '目标',   description: 'Set session goal with budget',                     category: 'session' },
    { name: 'relay',       zhName: '接力',   description: 'Relay to fresh agent',                             category: 'session' },
    { name: 'cycle',       zhName: '周期',   description: 'Show a specific compaction cycle',                 category: 'session' },
    { name: 'cycles',      zhName: '周期列表', description: 'List compaction cycles',                         category: 'session' },

    // ── Debug 调试 (11) ──
    { name: 'context',     zhName: '上下文', description: 'Show context window usage',                        category: 'debug' },
    { name: 'tokens',      zhName: 'Token',  description: 'Token counts for current turn',                    category: 'debug' },
    { name: 'cost',        zhName: '费用',   description: 'Cost estimate for current session',                category: 'debug' },
    { name: 'cache',       zhName: '缓存',   description: 'Prefix-cache hit/miss stats',                      category: 'debug' },
    { name: 'diff',        zhName: '差异',   description: 'Show latest file diff',                            category: 'debug' },
    { name: 'undo',        zhName: '撤销',   description: 'Undo last file change',                            category: 'debug' },
    { name: 'retry',       zhName: '重试',   description: 'Retry last turn',                                  category: 'debug' },
    { name: 'edit',        zhName: '编辑',   description: 'Open last edited file in editor',                  category: 'debug' },
    { name: 'change',      zhName: '变更',   description: 'Show changelog',                                   category: 'debug' },
    { name: 'system',      zhName: '系统',   description: 'Show current system prompt',                       category: 'debug' },
    { name: 'recall',      zhName: '回忆',   description: 'Search compressed context',                        category: 'debug' },

    // ── Tools 工具 (12) ──
    { name: 'mcp',         zhName: 'MCP',    description: 'Manage MCP servers',                               category: 'tools' },
    { name: 'task',        zhName: '任务',   description: 'Manage background tasks',                          category: 'tools' },
    { name: 'jobs',        zhName: '作业',   description: 'Manage background jobs',                           category: 'tools' },
    { name: 'note',        zhName: '笔记',   description: 'Persistent notes across sessions',                 category: 'tools' },
    { name: 'review',      zhName: '审查',   description: 'Review code changes in workspace',                 category: 'tools' },
    { name: 'skill',       zhName: '技能',   description: 'Activate / install a skill',                       category: 'tools' },
    { name: 'skills',      zhName: '技能列表', description: 'List available skills',                          category: 'tools' },
    { name: 'feedback',    zhName: '反馈',   description: 'Submit feedback (bug / feature)',                  category: 'tools' },
    { name: 'hooks',       zhName: '钩子',   description: 'Manage hooks',                                     category: 'tools' },
    { name: 'lsp',         zhName: '语言服务', description: 'LSP integration toggle',                         category: 'tools' },
    { name: 'memory',      zhName: '记忆',   description: 'Agent memory management',                          category: 'tools' },
    { name: 'network',     zhName: '网络',   description: 'Network permission management',                    category: 'tools' },

    // ── Config / Other (7) ──
    { name: 'logout',      zhName: '登出',   description: 'Log out current provider',                         category: 'config' },
    { name: 'settings',    zhName: '设置',   description: 'Show / open settings',                             category: 'config' },
    { name: 'profile',     zhName: '配置',   description: 'Switch configuration profile',                     category: 'config' },
    { name: 'status',      zhName: '状态',   description: 'Show runtime status',                              category: 'config' },
    { name: 'restore',     zhName: '恢复',   description: 'Roll back workspace to prior snapshot',            category: 'other' },
    { name: 'rlm',         zhName: '递归',   description: 'Run recursive language model',                     category: 'other' },
    { name: 'attach',      zhName: '附加',   description: 'Attach file / image to context',                   category: 'other' },
];

// ── 帮助面板分类定义 ──
export interface HelpSection {
    title: string;
    color: string;
    commands: HelpCmd[];
}
export interface HelpCmd {
    names: string[];
    desc: string;
    usage: string;
}

export function getHelpSections(): HelpSection[] {
    return [
        {
            title: '⌨️ Keybindings — Celest 快捷键',
            color: '#60a5fa',
            commands: [
                { names: ['Ctrl+L'],                desc: 'Focus chat input / 聚焦输入框',             usage: '' },
                { names: ['Ctrl+Shift+L'],          desc: 'Add file to chat / 添加文件到聊天',         usage: '' },
                { names: ['Alt+A'],                 desc: 'Apply code from chat / 应用代码',           usage: '' },
                { names: ['Shift+Ctrl+Enter'],      desc: 'Accept diff / 接受差异',                     usage: '' },
                { names: ['Shift+Ctrl+Backspace'],  desc: 'Reject diff / 拒绝差异',                     usage: '' },
            ],
        },
        {
            title: '📋 / Commands — Core 核心',
            color: '#34d399',
            commands: [
                { names: ['clear', 'qingping'],       desc: 'Clear chat display / 清空聊天',                       usage: '/clear' },
                { names: ['compact', 'yasuo'],        desc: 'Compact context to reduce tokens / 压缩上下文',       usage: '/compact' },
                { names: ['help', 'bangzhu'],         desc: 'Show help panel / 显示帮助',                           usage: '/help' },
                { names: ['model', 'moxing'],         desc: 'Switch AI model / 切换模型',                            usage: '/model <name>' },
                { names: ['models', 'moxingliebiao'], desc: 'List available models / 模型列表',                      usage: '/models' },
                { names: ['mode', 'moshi'],           desc: 'Switch mode (agent/plan/yolo) / 切换模式',              usage: '/mode <mode>' },
                { names: ['provider', 'gongyingshang'], desc: 'Switch API provider / 切换供应商',                    usage: '/provider <name>' },
                { names: ['doctor', 'zhenduan'],      desc: 'Run TUI health check / 诊断',                            usage: '/doctor' },
                { names: ['version', 'banben'],       desc: 'Show TUI version / 显示版本',                            usage: '/version' },
                { names: ['agent', 'zidaili'],        desc: 'Manage sub-agents / 管理子代理',                         usage: '/agent [list|spawn|kill]' },
                { names: ['config', 'peizhi'],        desc: 'Show / edit runtime config / 运行时配置',                usage: '/config' },
                { names: ['links', 'lianjie'],        desc: 'Dashboard & API links / 面板和API链接',                   usage: '/links' },
                { names: ['stash', 'zhancun'],        desc: 'Stash current session / 暂存会话',                       usage: '/stash' },
                { names: ['queue', 'duilie'],         desc: 'Show queued prompts / 排队中的提示',                     usage: '/queue' },
            ],
        },
        {
            title: '📋 / Commands — Session 会话',
            color: '#fbbf24',
            commands: [
                { names: ['rename', 'zhongmingming'], desc: 'Rename current session / 重命名会话',                    usage: '/rename <title>' },
                { names: ['fork', 'fencha'],          desc: 'Fork current session / 分支会话',                        usage: '/fork' },
                { names: ['new', 'xinjian'],          desc: 'Start a fresh session / 新会话',                          usage: '/new' },
                { names: ['load', 'jiazai'],          desc: 'Load a saved session / 加载会话',                         usage: '/load <id>' },
                { names: ['save', 'baocun'],          desc: 'Save current session / 保存会话',                         usage: '/save' },
                { names: ['sessions', 'huihua'],      desc: 'List / resume sessions / 会话列表',                       usage: '/sessions' },
                { names: ['share', 'fenxiang'],       desc: 'Share session as markdown / 分享会话',                    usage: '/share' },
                { names: ['export', 'daochu'],        desc: 'Export session as markdown / 导出',                       usage: '/export' },
                { names: ['init', 'chushihua'],       desc: 'Initialize project instructions / 初始化项目',            usage: '/init' },
                { names: ['goal', 'mubiao'],          desc: 'Set session goal with budget / 设定目标',                  usage: '/goal <obj> [budget:N]' },
                { names: ['relay', 'jieli'],          desc: 'Relay to fresh agent / 接力到新代理',                     usage: '/relay' },
                { names: ['cycle', 'zhouqi'],         desc: 'Show a compaction cycle / 显示压缩周期',                  usage: '/cycle <N>' },
                { names: ['cycles', 'zhouqiliebiao'], desc: 'List compaction cycles / 压缩周期列表',                   usage: '/cycles' },
            ],
        },
        {
            title: '📋 / Commands — Debug 调试',
            color: '#f472b6',
            commands: [
                { names: ['context', 'ctx'],          desc: 'Context window usage / 上下文使用量',                     usage: '/context' },
                { names: ['tokens', 'lingpai'],       desc: 'Token counts for current turn / Token统计',               usage: '/tokens' },
                { names: ['cost', 'feiyong'],         desc: 'Cost estimate for session / 费用估算',                    usage: '/cost' },
                { names: ['cache', 'huancun'],        desc: 'Prefix-cache hit/miss stats / 缓存统计',                   usage: '/cache' },
                { names: ['diff', 'chayi'],           desc: 'Show latest file diff / 显示最新差异',                    usage: '/diff' },
                { names: ['undo', 'chexiao'],         desc: 'Undo last file change / 撤销修改',                        usage: '/undo' },
                { names: ['retry', 'chongshi'],       desc: 'Retry last turn / 重试上一轮',                             usage: '/retry' },
                { names: ['edit', 'bianji'],          desc: 'Open last edited file in editor / 打开最近编辑的文件',    usage: '/edit' },
                { names: ['change', 'biangeng'],      desc: 'Show changelog / 变更日志',                                usage: '/change [version]' },
                { names: ['system', 'xitong'],        desc: 'Show current system prompt / 显示系统提示',               usage: '/system' },
                { names: ['recall', 'huiyi'],         desc: 'Search compressed context / 搜索压缩上下文',             usage: '/recall <query>' },
            ],
        },
        {
            title: '📋 / Commands — Tools 工具',
            color: '#a78bfa',
            commands: [
                { names: ['mcp'],                     desc: 'Manage MCP servers / MCP服务管理',                         usage: '/mcp [init|add|enable|disable]' },
                { names: ['task', 'tasks'],           desc: 'Manage background tasks / 后台任务',                       usage: '/task [add|list|show|cancel]' },
                { names: ['jobs', 'job', 'zuoye'],    desc: 'Manage background jobs / 后台作业',                        usage: '/jobs [list|show|poll|cancel]' },
                { names: ['note', 'biji'],            desc: 'Persistent notes across sessions / 笔记',                  usage: '/note [add|list|show|edit]' },
                { names: ['review', 'shencha'],       desc: 'Review code changes in workspace / 代码审查',              usage: '/review <target>' },
                { names: ['skill', 'jineng'],         desc: 'Activate / install a skill / 技能管理',                    usage: '/skill <name|install|update>' },
                { names: ['skills', 'jinengliebiao'], desc: 'List available skills / 技能列表',                          usage: '/skills' },
                { names: ['feedback', 'fankui'],      desc: 'Submit feedback (bug/feature) / 提交反馈',                  usage: '/feedback [bug|feature]' },
                { names: ['hooks', 'gouzi'],          desc: 'Manage hooks / 钩子管理',                                   usage: '/hooks [list|enable|disable]' },
                { names: ['lsp', 'yuyanfuwu'],        desc: 'LSP integration toggle / LSP集成',                          usage: '/lsp [on|off|status]' },
                { names: ['memory', 'jiyi'],          desc: 'Agent memory management / 记忆管理',                         usage: '/memory [show|edit|clear]' },
                { names: ['network', 'wangluo'],      desc: 'Network permission management / 网络权限',                  usage: '/network [list|allow|deny]' },
            ],
        },
        {
            title: '📋 / Commands — Config & Other 其他',
            color: '#38bdf8',
            commands: [
                { names: ['logout', 'dengchu'],       desc: 'Log out current provider / 登出当前供应商',                 usage: '/logout' },
                { names: ['settings', 'shezhi'],      desc: 'Show / open settings / 设置',                               usage: '/settings' },
                { names: ['profile', 'dangan'],       desc: 'Switch configuration profile / 配置文件',                   usage: '/profile <name>' },
                { names: ['status', 'zhuangtai'],     desc: 'Show runtime status / 运行状态',                             usage: '/status' },
                { names: ['restore', 'huifu'],        desc: 'Roll back workspace to snapshot / 恢复工作区',              usage: '/restore [N]' },
                { names: ['rlm', 'recursive', 'digui'], desc: 'Run recursive language model / 递归语言模型',            usage: '/rlm [N] <file_or_text>' },
                { names: ['attach', 'fujia'],         desc: 'Attach file / image to context / 附加文件',                 usage: '/attach <path>' },
            ],
        },
    ];
}
