/**
 * Celest i18n — 轻量国际化模块（零依赖）
 * 
 * 使用方式:
 *   import { t, setLocale } from './i18n';
 *   setLocale('zh-CN');
 *   t('settings.title')  // → "Celest 设置"
 * 
 * 文案来源:
 *   - `zh.json` / `en.json` — UI 静态文案
 *   - 工具描述保持 TUI 端原样透传（不翻译）
 */

type Locale = 'zh-CN' | 'en';

interface I18nMessages {
    [key: string]: string | I18nMessages;
}

const messages: Record<Locale, I18nMessages> = {
    'zh-CN': {
        settings: {
            title: 'Celest 设置',
            general: '通用',
            model: '模型',
            about: '关于',
            apiBase: 'API 基础 URL',
            apiBaseDesc: 'DeepSeek API 的基础地址',
            apiKey: 'API Key',
            apiKeyDesc: '你的 DeepSeek API 密钥（安全存储在系统密钥链中）',
            apiKeySet: '已设置',
            apiKeyNotSet: '未设置',
            apiKeyPlaceholder: '输入你的 API Key...',
            save: '保存',
            cancel: '取消',
            changeKey: '更改密钥',
            clearKey: '清除密钥',
            defaultModel: '默认模型',
            defaultModelDesc: '新会话的默认模型',
            reasoningEffort: '推理深度',
            reasoningEffortDesc: '模型思考深度（off/low/medium/high/max）',
            provider: '服务提供商',
            providerDesc: 'API 服务提供商',
            autoDownload: '自动下载二进制',
            autoDownloadDesc: '首次使用时自动从 GitHub Release 下载 deepseek-tui',
            binaryPath: '二进制路径',
            binaryPathDesc: 'deepseek-tui 可执行文件的路径（留空使用自动下载）',
            locale: '界面语言',
            localeDesc: 'Celest 用户界面语言',
            version: '版本',
            tuiVersion: 'TUI 版本',
            tuiStatus: 'TUI 状态',
            nodeVersion: 'Node 版本',
            vscodeVersion: 'VS Code 版本',
            download: '下载 codewhale',
            downloading: '下载中...',
            downloadSuccess: '下载完成',
            downloadFailed: '下载失败',
            checkUpdate: '检查更新',
        },
        model: {
            label: '模型',
            switchTo: '切换到',
            switching: '切换中...',
            switched: '已切换',
            notConnected: 'TUI 未连接',
        },
        binary: {
            downloading: '正在下载 deepseek-tui...',
            extracting: '正在解压...',
            verifying: '正在验证...',
            complete: 'deepseek-tui 下载完成',
            failed: '下载失败',
            notFound: '未找到 deepseek-tui 二进制文件',
            autoDownloadPrompt: '未找到 deepseek-tui，是否自动下载？',
            downloadNow: '立即下载',
            locateManually: '手动指定路径',
            progress: '下载进度',
        },
        common: {
            confirm: '确认',
            cancel: '取消',
            close: '关闭',
            refresh: '刷新',
            loading: '加载中...',
            error: '错误',
            success: '成功',
            unknown: '未知',
        },
        panel: {
            work: '工作流',
            plan: '计划',
            tasks: '任务流',
            skills: '技能',
            agents: '子代理',
            context: '上下文',
            usage: '统计用量',
        },
        connecting: '正在连接 DeepSeek TUI...',
        clearChat: '清空对话',
        newWindow: '在新窗口打开',
    },
    'en': {
        settings: {
            title: 'Celest Settings',
            general: 'General',
            model: 'Model',
            about: 'About',
            apiBase: 'API Base URL',
            apiBaseDesc: 'Base URL for DeepSeek API',
            apiKey: 'API Key',
            apiKeyDesc: 'Your DeepSeek API key (stored securely in system keychain)',
            apiKeySet: 'Set',
            apiKeyNotSet: 'Not set',
            apiKeyPlaceholder: 'Enter your API Key...',
            save: 'Save',
            cancel: 'Cancel',
            changeKey: 'Change Key',
            clearKey: 'Clear Key',
            defaultModel: 'Default Model',
            defaultModelDesc: 'Default model for new sessions',
            reasoningEffort: 'Reasoning Effort',
            reasoningEffortDesc: 'Model thinking depth (off/low/medium/high/max)',
            provider: 'Provider',
            providerDesc: 'API service provider',
            autoDownload: 'Auto-download Binary',
            autoDownloadDesc: 'Auto-download deepseek-tui from GitHub Release on first use',
            binaryPath: 'Binary Path',
            binaryPathDesc: 'Path to deepseek-tui executable (leave empty for auto-download)',
            locale: 'Language',
            localeDesc: 'Celest UI language',
            version: 'Version',
            tuiVersion: 'TUI Version',
            tuiStatus: 'TUI Status',
            nodeVersion: 'Node Version',
            vscodeVersion: 'VS Code Version',
            download: 'Download codewhale',
            downloading: 'Downloading...',
            downloadSuccess: 'Download complete',
            downloadFailed: 'Download failed',
            checkUpdate: 'Check for Updates',
        },
        model: {
            label: 'Model',
            switchTo: 'Switch to',
            switching: 'Switching...',
            switched: 'Switched',
            notConnected: 'TUI not connected',
        },
        binary: {
            downloading: 'Downloading deepseek-tui...',
            extracting: 'Extracting...',
            verifying: 'Verifying...',
            complete: 'deepseek-tui download complete',
            failed: 'Download failed',
            notFound: 'deepseek-tui binary not found',
            autoDownloadPrompt: 'deepseek-tui not found. Download automatically?',
            downloadNow: 'Download Now',
            locateManually: 'Locate Manually',
            progress: 'Download progress',
        },
        common: {
            confirm: 'Confirm',
            cancel: 'Cancel',
            close: 'Close',
            refresh: 'Refresh',
            loading: 'Loading...',
            error: 'Error',
            success: 'Success',
            unknown: 'Unknown',
        },
        panel: {
            work: 'Work',
            plan: 'Plan',
            tasks: 'Tasks',
            agents: 'Agents',
            skills: 'Skills',
            context: 'Context',
            usage: 'Usage',
        },
        connecting: 'Connecting to DeepSeek TUI...',
        clearChat: 'Clear Chat',
        newWindow: 'Open in New Window',
    },
};

let currentLocale: Locale = 'zh-CN';

export function setLocale(locale: Locale): void {
    currentLocale = locale;
}

export function getLocale(): Locale {
    return currentLocale;
}

/**
 * 获取翻译文本
 * @param key 点分隔的键，如 'settings.title'
 * @param fallback 如果未找到翻译，返回的默认值
 */
export function t(key: string, fallback?: string): string {
    const parts = key.split('.');
    let current: any = messages[currentLocale];
    
    for (const part of parts) {
        if (current == null || typeof current !== 'object') {
            return fallback ?? key;
        }
        current = current[part];
    }
    
    if (typeof current === 'string') {
        return current;
    }
    
    // 尝试英文 fallback
    if (currentLocale !== 'en') {
        let enCurrent: any = messages['en'];
        for (const part of parts) {
            if (enCurrent == null || typeof enCurrent !== 'object') break;
            enCurrent = enCurrent[part];
        }
        if (typeof enCurrent === 'string') return enCurrent;
    }
    
    return fallback ?? key;
}

/** 获取可用模型列表 — 对齐 TUI config.example.toml */
export function getAvailableModels(): { id: string; name: string; description: string }[] {
    return [
        { id: 'deepseek-v4-pro', name: 'V4 Pro', description: 'DeepSeek 旗舰推理模型' },
        { id: 'deepseek-v4-flash', name: 'V4 Flash', description: '快速经济 — 日常编码首选' },
        { id: 'deepseek-chat', name: 'DeepSeek Chat', description: '通用对话 (V3 legacy)' },
        { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', description: '深度推理 (R1 legacy)' },
        { id: 'deepseek-ai/deepseek-v4-pro', name: 'V4 Pro (NIM)', description: 'NVIDIA NIM 托管 Pro' },
        { id: 'deepseek-ai/deepseek-v4-flash', name: 'V4 Flash (NIM)', description: 'NVIDIA NIM 托管 Flash' },
        { id: 'gpt-4.1', name: 'GPT-4.1', description: 'OpenAI GPT-4.1' },
        { id: 'gpt-4o', name: 'GPT-4o', description: 'OpenAI GPT-4o' },
        { id: 'qwen-turbo', name: 'Qwen Turbo', description: '通义千问 Turbo — 快速经济' },
        { id: 'qwen-plus', name: 'Qwen Plus', description: '通义千问 Plus — 平衡性能' },
        { id: 'qwen-max', name: 'Qwen Max', description: '通义千问 Max — 最强推理' },
    ];
}

/** 获取推理深度选项 */
export function getReasoningEfforts(): { id: string; name: string }[] {
    const names: Record<string, Record<string, string>> = {
        'off': { 'zh-CN': '关闭', 'en': 'Off' },
        'low': { 'zh-CN': '低', 'en': 'Low' },
        'medium': { 'zh-CN': '中', 'en': 'Medium' },
        'high': { 'zh-CN': '高', 'en': 'High' },
        'max': { 'zh-CN': '最高', 'en': 'Max' },
    };
    return Object.entries(names).map(([id, n]) => ({
        id,
        name: n[currentLocale] || n['en'] || id,
    }));
}
