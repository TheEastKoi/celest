// Celest Help 数据 — 与 TUI 0.8.40 COMMANDS + KEYBINDINGS 对齐，A-Z 排序

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

const C = ['#60a5fa','#34d399','#fbbf24','#f472b6','#a78bfa','#38bdf8','#fb923c','#4ade80','#60a5fa','#34d399','#fbbf24','#f472b6','#a78bfa','#38bdf8','#fb923c'];
let ci = 0;
function nc() { return C[ci++ % C.length]; }

export function getHelpSections(): HelpSection[] {
    ci = 0;
    return [
        { title:'⌨️ 快捷键 — 导航 Navigation', color:nc(), commands:[
            { names:['[',']'], desc:'跳转工具块', usage:'' },
            { names:['Alt+↑','Alt+↓'], desc:'快速滚动', usage:'' },
            { names:['Ctrl+Home','Ctrl+End'], desc:'跳转首尾', usage:'' },
            { names:['Ctrl+↑','Ctrl+↓'], desc:'浏览历史', usage:'' },
            { names:['PgUp','PgDn'], desc:'翻页', usage:'' },
            { names:['Shift+↑','Shift+↓'], desc:'历史浏览', usage:'' },
            { names:['g','G'], desc:'跳转首尾（空输入）', usage:'' },
            { names:['↑','↓'], desc:'滚动对话', usage:'' },
        ]},
        { title:'⌨️ 快捷键 — 编辑 Editing', color:nc(), commands:[
            { names:['Alt+R'], desc:'搜索历史', usage:'' },
            { names:['Backspace','Delete'], desc:'删除字符', usage:'' },
            { names:['Ctrl+A','Ctrl+E'], desc:'行首尾', usage:'' },
            { names:['Ctrl+J','Alt+Enter','Shift+Enter'], desc:'换行', usage:'' },
            { names:['Ctrl+S'], desc:'暂存草稿', usage:'' },
            { names:['Ctrl+U'], desc:'清空草稿', usage:'' },
            { names:['Home','End'], desc:'行首尾', usage:'' },
            { names:['←','→'], desc:'移动光标', usage:'' },
        ]},
        { title:'⌨️ 快捷键 — 提交 Submission', color:nc(), commands:[
            { names:['Alt+C'], desc:'压缩检查', usage:'' },
            { names:['Alt+V'], desc:'工具详情', usage:'' },
            { names:['Ctrl+B'], desc:'终端控制', usage:'' },
            { names:['Ctrl+C'], desc:'取消/退出', usage:'' },
            { names:['Ctrl+D'], desc:'空输入退出', usage:'' },
            { names:['Ctrl+K'], desc:'命令面板', usage:'' },
            { names:['Ctrl+O'], desc:'活动详情', usage:'' },
            { names:['Ctrl+P'], desc:'文件选择', usage:'' },
            { names:['Ctrl+T'], desc:'实时记录', usage:'' },
            { names:['Enter'], desc:'发送', usage:'' },
            { names:['Esc'], desc:'关闭菜单', usage:'' },
            { names:['Esc','Esc'], desc:'回退消息', usage:'' },
            { names:['l'], desc:'上条消息', usage:'' },
            { names:['v'], desc:'详情', usage:'' },
        ]},
        { title:'⌨️ 快捷键 — 模式 Modes', color:nc(), commands:[
            { names:['Alt+!','Alt+@','Alt+#','Alt+$'], desc:'焦点侧边栏', usage:'' },
            { names:['Alt+1','Alt+2','Alt+3'], desc:'Plan/Agent/Yolo 切换', usage:'' },
            { names:['Alt+P','Alt+A','Alt+Y'], desc:'Plan/Agent/Yolo 切换', usage:'' },
            { names:['Ctrl+X'], desc:'计划/代理切换', usage:'' },
            { names:['Tab','Shift+Tab'], desc:'切换模式', usage:'' },
        ]},
        { title:'⌨️ 快捷键 — 会话 Sessions', color:nc(), commands:[
            { names:['Ctrl+R'], desc:'会话选择', usage:'' },
        ]},
        { title:'⌨️ 快捷键 — 剪贴板 Clipboard', color:nc(), commands:[
            { names:['@path'], desc:'附加路径', usage:'' },
            { names:['Ctrl+Shift+C'], desc:'复制选中', usage:'' },
            { names:['Ctrl+V'], desc:'粘贴附加', usage:'' },
            { names:['右键'], desc:'右键菜单', usage:'' },
        ]},
        { title:'⌨️ 快捷键 — 帮助 Help', color:nc(), commands:[
            { names:['?'], desc:'帮助覆盖层', usage:'' },
            { names:['Ctrl+/'], desc:'切换帮助', usage:'' },
            { names:['F1'], desc:'切换帮助', usage:'' },
        ]},
        { title:'核心 Core', color:nc(), commands:[
            { names:['agent'], desc:'运行子代理', usage:'/agent [N] <task>' },
            { names:['anchor'], desc:'添加锚点', usage:'/anchor <text>' },
            { names:['attach'], desc:'附加文件/图片', usage:'/attach <path>' },
            { names:['clear'], desc:'清空对话', usage:'/clear' },
            { names:['help','?'], desc:'显示帮助', usage:'/help [cmd]' },
            { names:['home'], desc:'首页仪表板', usage:'/home' },
            { names:['links'], desc:'仪表板 & API 链接', usage:'/links' },
            { names:['model'], desc:'切换 AI 模型', usage:'/model [name]' },
            { names:['mode'], desc:'切换模式', usage:'/mode [agent|plan|yolo]' },
            { names:['models'], desc:'模型列表', usage:'/models' },
            { names:['provider'], desc:'切换供应商', usage:'/provider [name]' },
            { names:['queue'], desc:'队列提示', usage:'/queue [list|edit|drop|clear]' },
            { names:['stash','park'], desc:'暂存会话', usage:'/stash [list|pop|clear]' },
            { names:['subagents'], desc:'子代理状态', usage:'/subagents' },
            { names:['workspace','cwd'], desc:'显示/切换工作区', usage:'/workspace [path]' },
        ]},
        { title:'会话 Session', color:nc(), commands:[
            { names:['compact'], desc:'压缩上下文', usage:'/compact' },
            { names:['cycle'], desc:'显示指定周期', usage:'/cycle <n>' },
            { names:['cycles'], desc:'压缩周期', usage:'/cycles' },
            { names:['export'], desc:'导出为 Markdown', usage:'/export [path]' },
            { names:['fork','branch'], desc:'分支会话', usage:'/fork' },
            { names:['load'], desc:'加载会话', usage:'/load [path]' },
            { names:['recall'], desc:'搜索压缩上下文', usage:'/recall <query>' },
            { names:['relay'], desc:'接力到新代理', usage:'/relay' },
            { names:['rename'], desc:'重命名会话', usage:'/rename <title>' },
            { names:['save'], desc:'保存会话', usage:'/save [path]' },
            { names:['sessions','resume'], desc:'列出/恢复会话', usage:'/sessions' },
        ]},
        { title:'配置 Config', color:nc(), commands:[
            { names:['config'], desc:'打开配置', usage:'/config' },
            { names:['logout'], desc:'登出供应商', usage:'/logout' },
            { names:['settings'], desc:'显示设置', usage:'/settings' },
            { names:['status'], desc:'运行时状态', usage:'/status' },
            { names:['statusline'], desc:'切换状态栏', usage:'/statusline' },
            { names:['theme'], desc:'切换主题', usage:'/theme [name]' },
            { names:['trust'], desc:'信任目录', usage:'/trust [on|off|add|list]' },
            { names:['verbose'], desc:'详细模式', usage:'/verbose [on|off]' },
        ]},
        { title:'调试 Debug', color:nc(), commands:[
            { names:['cache'], desc:'缓存统计', usage:'/cache' },
            { names:['change'], desc:'变更日志', usage:'/change' },
            { names:['context','ctx'], desc:'上下文使用', usage:'/context' },
            { names:['cost'], desc:'费用估算', usage:'/cost' },
            { names:['diff'], desc:'最新差异', usage:'/diff' },
            { names:['edit'], desc:'打开最后文件', usage:'/edit' },
            { names:['retry'], desc:'重试最后一轮', usage:'/retry' },
            { names:['system'], desc:'系统提示', usage:'/system' },
            { names:['tokens'], desc:'Token 统计', usage:'/tokens' },
            { names:['translate'], desc:'翻译上条消息', usage:'/translate' },
            { names:['undo'], desc:'撤销上次更改', usage:'/undo' },
        ]},
        { title:'工具 Tools', color:nc(), commands:[
            { names:['hooks'], desc:'管理钩子', usage:'/hooks [list|events]' },
            { names:['jobs'], desc:'后台作业', usage:'/jobs [list|show|poll|cancel]' },
            { names:['lsp'], desc:'LSP 集成', usage:'/lsp [on|off]' },
            { names:['mcp'], desc:'MCP 服务器', usage:'/mcp [init|add|enable|disable]' },
            { names:['memory'], desc:'代理记忆', usage:'/memory [show|edit|clear]' },
            { names:['network'], desc:'网络权限', usage:'/network [list|allow|deny]' },
            { names:['note'], desc:'持久化笔记', usage:'/note [add|list|show|edit]' },
            { names:['task','tasks'], desc:'后台任务', usage:'/task [add|list|show|cancel]' },
        ]},
        { title:'项目 Project', color:nc(), commands:[
            { names:['feedback'], desc:'提交反馈', usage:'/feedback [bug|feature]' },
            { names:['goal'], desc:'设定目标', usage:'/goal <text>' },
            { names:['init'], desc:'初始化项目指令', usage:'/init' },
            { names:['review'], desc:'代码审查', usage:'/review' },
            { names:['share'], desc:'分享为 Markdown', usage:'/share' },
        ]},
        { title:'技能 Skills', color:nc(), commands:[
            { names:['skill'], desc:'运行技能', usage:'/skill <name>' },
            { names:['skills'], desc:'技能列表', usage:'/skills' },
        ]},
        { title:'其他 Other', color:nc(), commands:[
            { names:['exit','quit','q'], desc:'退出 TUI (CLI)', usage:'/exit' },
            { names:['profile'], desc:'配置文件管理', usage:'/profile' },
            { names:['restore'], desc:'恢复会话', usage:'/restore' },
            { names:['rlm'], desc:'递归语言模型', usage:'/rlm' },
        ]},
    ];
}
