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
            apiKeyDesc: '你的 API 密钥（安全存储在系统密钥链中）',
            apiKeyForProvider: '{provider} 的 API Key：',
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
            pathSuffix: 'API 路径后缀',
            pathSuffixDesc: '覆写 API 路径后缀（如 /chat/completions），适用于自建网关或非标准端点',
            pathSuffixPlaceholder: '留空使用默认路径',
            providerCredentials: 'Provider 凭证',
            configureProvider: '配置 Provider',
            configureProviderDesc: '为每个 Provider 单独设置 API Key、Base URL 和默认模型。凭证安全存储在系统密钥链中。',
            providerBaseUrl: 'Base URL',
            providerBaseUrlDesc: 'API 端点地址（默认: {default}）',
            providerModel: '默认模型',
            providerModelDesc: '该 Provider 的默认模型（默认: {default}）',
            autoDownload: '自动下载二进制',
            autoDownloadDesc: '首次使用时自动从 GitHub Release 下载 codewhale-tui',
            binaryPath: '二进制路径',
            binaryPathDesc: 'codewhale-tui 可执行文件的路径（留空使用自动下载）',
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
            downloading: '正在下载 codewhale-tui...',
            extracting: '正在解压...',
            verifying: '正在验证...',
            complete: 'codewhale-tui 下载完成',
            failed: '下载失败',
            notFound: '未找到 codewhale-tui 二进制文件',
            autoDownloadPrompt: '未找到 codewhale-tui，是否自动下载？',
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
        connecting: '正在连接 CodeWhale TUI...',
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
            apiKeyDesc: 'Your API key (stored securely in system keychain)',
            apiKeyForProvider: 'API Key for {provider}:',
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
            pathSuffix: 'API Path Suffix',
            pathSuffixDesc: 'Override API path suffix, e.g. /chat/completions (for self-hosted gateways or non-standard endpoints)',
            pathSuffixPlaceholder: 'Leave empty for default path',
            providerCredentials: 'Provider Credentials',
            configureProvider: 'Configure Provider',
            configureProviderDesc: 'Set API Key, Base URL, and default model per provider. Credentials are stored securely in the system keychain.',
            providerBaseUrl: 'Base URL',
            providerBaseUrlDesc: 'API endpoint URL (default: {default})',
            providerModel: 'Default Model',
            providerModelDesc: 'Default model for this provider (default: {default})',
            autoDownload: 'Auto-download Binary',
            autoDownloadDesc: 'Auto-download codewhale-tui from GitHub Release on first use',
            binaryPath: 'Binary Path',
            binaryPathDesc: 'Path to codewhale-tui executable (leave empty for auto-download)',
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
            downloading: 'Downloading codewhale-tui...',
            extracting: 'Extracting...',
            verifying: 'Verifying...',
            complete: 'codewhale-tui download complete',
            failed: 'Download failed',
            notFound: 'codewhale-tui binary not found',
            autoDownloadPrompt: 'codewhale-tui not found. Download automatically?',
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
        connecting: 'Connecting to CodeWhale TUI...',
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
/**
 * 获取翻译文本，支持模板插值
 * @param key 点分隔的键，如 'settings.apiKeyForProvider'
 * @param params 模板参数，如 { provider: 'openai' }
 */
export function t(key: string, params?: Record<string, string>): string {
    const parts = key.split('.');
    let current: any = messages[currentLocale];
    
    for (const part of parts) {
        if (current == null || typeof current !== 'object') {
            return key;
        }
        current = current[part];
    }
    
    let result: string;
    if (typeof current === 'string') {
        result = current;
    } else if (currentLocale !== 'en') {
        // 尝试英文 fallback
        let enCurrent: any = messages['en'];
        for (const part of parts) {
            if (enCurrent == null || typeof enCurrent !== 'object') break;
            enCurrent = enCurrent[part];
        }
        result = typeof enCurrent === 'string' ? enCurrent : key;
    } else {
        result = key;
    }

    // 模板插值: {key} → value
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            result = result.replace(`{${k}}`, v);
        }
    }
    
    return result;
}

/** 获取可用模型列表 — 对齐 TUI config.example.toml v0.8.53 */
export function getAvailableModels(): { id: string; name: string; description: string; provider: string }[] {
    return [
        // DeepSeek 官方
        { id: 'deepseek-v4-pro', name: 'V4 Pro', description: 'DeepSeek 旗舰推理模型', provider: 'deepseek' },
        { id: 'deepseek-v4-flash', name: 'V4 Flash', description: '快速经济 — 日常编码首选', provider: 'deepseek' },
        // NVIDIA NIM
        { id: 'deepseek-ai/deepseek-v4-pro', name: 'V4 Pro (NVIDIA)', description: 'NVIDIA NIM 托管', provider: 'nvidia-nim' },
        { id: 'deepseek-ai/deepseek-v4-flash', name: 'V4 Flash (NVIDIA)', description: 'NVIDIA NIM 托管', provider: 'nvidia-nim' },
        // SiliconFlow / SGLang
        { id: 'deepseek-ai/DeepSeek-V4-Pro', name: 'V4 Pro (SiliconFlow)', description: 'SiliconFlow / SGLang 托管', provider: 'siliconflow' },
        { id: 'deepseek-ai/DeepSeek-V4-Flash', name: 'V4 Flash (SiliconFlow)', description: 'SiliconFlow / SGLang 托管', provider: 'siliconflow' },
        // OpenRouter
        { id: 'deepseek/deepseek-v4-pro', name: 'V4 Pro (OpenRouter)', description: 'OpenRouter 网关', provider: 'openrouter' },
        // Fireworks
        { id: 'accounts/fireworks/models/deepseek-v4-pro', name: 'V4 Pro (Fireworks)', description: 'Fireworks AI 托管', provider: 'fireworks' },
        // OpenAI
        { id: 'gpt-4.1', name: 'GPT-4.1', description: 'OpenAI 旗舰模型', provider: 'openai' },
        { id: 'gpt-4o', name: 'GPT-4o', description: 'OpenAI 多模态模型', provider: 'openai' },
        // Arcee
        { id: 'trinity-large-thinking', name: 'Trinity Large', description: 'Arcee AI 推理模型', provider: 'arcee' },
        // Moonshot/Kimi
        { id: 'kimi-k2.6', name: 'Kimi K2.6', description: 'Moonshot Kimi 推理模型', provider: 'moonshot' },
        // Xiaomi MiMo
        { id: 'mimo-v2.5-pro', name: 'MiMo 2.5 Pro', description: 'Xiaomi MiMo 推理模型', provider: 'xiaomi-mimo' },
        { id: 'mimo-v2.5', name: 'MiMo 2.5', description: 'Xiaomi MiMo 通用模型', provider: 'xiaomi-mimo' },
        // DashScope (阿里云百炼)
        { id: 'qwen3-235b-a22b', name: 'Qwen3 235B', description: '千问 3.7 旗舰推理模型', provider: 'dashscope' },
        { id: 'qwen3-235b-a22b-thinking', name: 'Qwen3 235B Thinking', description: '千问 3.7 深度思考模式', provider: 'dashscope' },
        { id: 'qwen3-30b-a3b', name: 'Qwen3 30B', description: '千问 3 中等规模模型', provider: 'dashscope' },
        { id: 'qwen-plus', name: 'Qwen Plus', description: '通义千问 Plus', provider: 'dashscope' },
        { id: 'qwen-max', name: 'Qwen Max', description: '通义千问 Max', provider: 'dashscope' },
        { id: 'qwen-turbo', name: 'Qwen Turbo', description: '通义千问 Turbo', provider: 'dashscope' },
    ];
}

/** 根据 Provider 获取推荐的模型列表 */
export function getModelsForProvider(providerId: string): { id: string; name: string; description: string }[] {
    return getAvailableModels().filter(m => m.provider === providerId);
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

/** 获取所有 Provider 列表（含 label 和 legacy 标记） */
export function getAllProviders(): { id: string; label: string; legacy: boolean }[] {
    return [
        { id: 'deepseek',     label: 'DeepSeek',           legacy: false },
        { id: 'openai',       label: 'OpenAI',             legacy: false },
        { id: 'nvidia-nim',   label: 'NVIDIA NIM',         legacy: false },
        { id: 'ollama',       label: 'Ollama',             legacy: false },
        { id: 'huggingface',  label: 'Hugging Face',       legacy: false },
        { id: 'arcee',        label: 'Arcee AI',           legacy: false },
        { id: 'moonshot',     label: 'Moonshot / Kimi',    legacy: false },
        { id: 'sglang',       label: 'SGLang',             legacy: false },
        { id: 'vllm',         label: 'vLLM',               legacy: false },
        { id: 'siliconflow',  label: 'SiliconFlow',        legacy: false },
        { id: 'siliconflow-CN', label: 'SiliconFlow CN',   legacy: false },
        { id: 'fireworks',    label: 'Fireworks AI',       legacy: false },
        { id: 'xiaomi-mimo',  label: 'Xiaomi MiMo',        legacy: false },
        { id: 'wanjie-ark',   label: 'Wanjie Ark',         legacy: false },
        { id: 'volcengine',   label: 'Volcengine Ark',     legacy: false },
        { id: 'openrouter',   label: 'OpenRouter',         legacy: false },
        { id: 'novita',       label: 'Novita AI',          legacy: false },
        { id: 'atlascloud',   label: 'AtlasCloud',         legacy: false },
        { id: 'dashscope',    label: 'DashScope (阿里云百炼)',  legacy: false },
        { id: 'deepseek-cn',  label: 'DeepSeek CN',        legacy: true },
    ];
}

/** 获取所有 Provider 的默认 Base URL 和 Model */
export function getProviderDefaults(): Record<string, { baseUrl: string; model: string }> {
    return {
        deepseek:       { baseUrl: 'https://api.deepseek.com',                  model: 'deepseek-v4-flash' },
        'deepseek-cn':  { baseUrl: 'https://api.deepseek.com',                  model: 'deepseek-v4-flash' },
        openai:         { baseUrl: 'https://api.openai.com/v1',                 model: 'gpt-4.1' },
        'nvidia-nim':   { baseUrl: 'https://integrate.api.nvidia.com/v1',      model: 'deepseek-ai/deepseek-v4-pro' },
        ollama:         { baseUrl: 'http://localhost:11434/v1',                model: 'deepseek-v4-flash' },
        huggingface:    { baseUrl: 'https://api-inference.huggingface.co/v1',  model: 'deepseek-ai/DeepSeek-V4-Pro' },
        arcee:          { baseUrl: 'https://api.arcee.ai/api/v1',              model: 'trinity-large-thinking' },
        moonshot:       { baseUrl: 'https://api.moonshot.ai/v1',               model: 'kimi-k2.6' },
        sglang:         { baseUrl: 'http://localhost:30000/v1',                model: 'deepseek-ai/DeepSeek-V4-Pro' },
        vllm:           { baseUrl: 'http://localhost:8000/v1',                 model: 'deepseek-ai/DeepSeek-V4-Pro' },
        siliconflow:    { baseUrl: 'https://api.siliconflow.com/v1',           model: 'deepseek-ai/DeepSeek-V4-Pro' },
        'siliconflow-CN': { baseUrl: 'https://api.siliconflow.cn/v1',          model: 'deepseek-ai/DeepSeek-V4-Pro' },
        fireworks:      { baseUrl: 'https://api.fireworks.ai/inference/v1',   model: 'accounts/fireworks/models/deepseek-v4-pro' },
        'xiaomi-mimo':  { baseUrl: 'https://api.xiaomimimo.com/v1',            model: 'mimo-v2.5-pro' },
        'wanjie-ark':   { baseUrl: 'https://maas-openapi.wanjiedata.com/api/v1', model: 'deepseek-v4-flash' },
        volcengine:     { baseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3', model: 'DeepSeek-V4-Pro' },
        openrouter:     { baseUrl: 'https://openrouter.ai/api/v1',             model: 'deepseek/deepseek-v4-pro' },
        novita:         { baseUrl: 'https://api.novita.ai/v1',                 model: 'deepseek/deepseek-v4-pro' },
        atlascloud:     { baseUrl: 'https://api.atlascloud.ai/v1',             model: 'deepseek-ai/deepseek-v4-flash' },
        dashscope:      { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3-235b-a22b' },
    };
}
