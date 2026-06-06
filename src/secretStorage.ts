import * as vscode from 'vscode';
import { logger } from './logger';

/**
 * CodeWhale TUI 支持的 Provider 列表及其环境变量映射。
 * 对齐 config.example.toml v0.8.53。
 */
export const PROVIDER_ENV_MAP: Record<string, { apiKeyEnv: string; baseUrlEnv: string; modelEnv: string; defaultBaseUrl: string; defaultModel: string }> = {
    deepseek:      { apiKeyEnv: 'DEEPSEEK_API_KEY',       baseUrlEnv: 'DEEPSEEK_BASE_URL',       modelEnv: 'DEEPSEEK_MODEL',       defaultBaseUrl: 'https://api.deepseek.com',                 defaultModel: 'deepseek-v4-flash' },
    'deepseek-cn': { apiKeyEnv: 'DEEPSEEK_API_KEY',       baseUrlEnv: 'DEEPSEEK_BASE_URL',       modelEnv: 'DEEPSEEK_MODEL',       defaultBaseUrl: 'https://api.deepseek.com',                 defaultModel: 'deepseek-v4-flash' },
    openai:        { apiKeyEnv: 'OPENAI_API_KEY',          baseUrlEnv: 'OPENAI_BASE_URL',         modelEnv: 'OPENAI_MODEL',         defaultBaseUrl: 'https://api.openai.com/v1',                defaultModel: 'gpt-4.1' },
    'nvidia-nim':  { apiKeyEnv: 'NVIDIA_API_KEY',          baseUrlEnv: 'NIM_BASE_URL',            modelEnv: 'NVIDIA_NIM_MODEL',     defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',     defaultModel: 'deepseek-ai/deepseek-v4-pro' },
    ollama:        { apiKeyEnv: '',                        baseUrlEnv: 'OLLAMA_BASE_URL',         modelEnv: 'OLLAMA_MODEL',         defaultBaseUrl: 'http://localhost:11434/v1',               defaultModel: 'deepseek-v4-flash' },
    huggingface:   { apiKeyEnv: 'HUGGINGFACE_API_KEY',     baseUrlEnv: 'HUGGINGFACE_BASE_URL',    modelEnv: 'HUGGINGFACE_MODEL',    defaultBaseUrl: 'https://api-inference.huggingface.co/v1', defaultModel: 'deepseek-ai/DeepSeek-V4-Pro' },
    arcee:         { apiKeyEnv: 'ARCEE_API_KEY',           baseUrlEnv: 'ARCEE_BASE_URL',          modelEnv: 'ARCEE_MODEL',          defaultBaseUrl: 'https://api.arcee.ai/api/v1',             defaultModel: 'trinity-large-thinking' },
    moonshot:      { apiKeyEnv: 'MOONSHOT_API_KEY',        baseUrlEnv: 'MOONSHOT_BASE_URL',       modelEnv: 'MOONSHOT_MODEL',       defaultBaseUrl: 'https://api.moonshot.ai/v1',              defaultModel: 'kimi-k2.6' },
    sglang:        { apiKeyEnv: 'SGLANG_API_KEY',          baseUrlEnv: 'SGLANG_BASE_URL',         modelEnv: 'SGLANG_MODEL',         defaultBaseUrl: 'http://localhost:30000/v1',               defaultModel: 'deepseek-ai/DeepSeek-V4-Pro' },
    vllm:          { apiKeyEnv: 'VLLM_API_KEY',            baseUrlEnv: 'VLLM_BASE_URL',           modelEnv: 'VLLM_MODEL',           defaultBaseUrl: 'http://localhost:8000/v1',                defaultModel: 'deepseek-ai/DeepSeek-V4-Pro' },
    siliconflow:   { apiKeyEnv: 'SILICONFLOW_API_KEY',     baseUrlEnv: 'SILICONFLOW_BASE_URL',    modelEnv: 'SILICONFLOW_MODEL',    defaultBaseUrl: 'https://api.siliconflow.com/v1',          defaultModel: 'deepseek-ai/DeepSeek-V4-Pro' },
    'siliconflow-CN': { apiKeyEnv: 'SILICONFLOW_API_KEY',  baseUrlEnv: 'SILICONFLOW_BASE_URL',    modelEnv: 'SILICONFLOW_MODEL',    defaultBaseUrl: 'https://api.siliconflow.cn/v1',           defaultModel: 'deepseek-ai/DeepSeek-V4-Pro' },
    fireworks:     { apiKeyEnv: 'FIREWORKS_API_KEY',       baseUrlEnv: 'FIREWORKS_BASE_URL',      modelEnv: 'FIREWORKS_MODEL',      defaultBaseUrl: 'https://api.fireworks.ai/inference/v1',  defaultModel: 'accounts/fireworks/models/deepseek-v4-pro' },
    'xiaomi-mimo': { apiKeyEnv: 'XIAOMI_MIMO_API_KEY',     baseUrlEnv: 'XIAOMI_MIMO_BASE_URL',    modelEnv: 'XIAOMI_MIMO_MODEL',    defaultBaseUrl: 'https://api.xiaomimimo.com/v1',           defaultModel: 'mimo-v2.5-pro' },
    'wanjie-ark':  { apiKeyEnv: 'WANJIE_ARK_API_KEY',      baseUrlEnv: 'WANJIE_ARK_BASE_URL',     modelEnv: 'WANJIE_ARK_MODEL',     defaultBaseUrl: 'https://maas-openapi.wanjiedata.com/api/v1', defaultModel: 'deepseek-v4-flash' },
    volcengine:    { apiKeyEnv: 'VOLCENGINE_API_KEY',      baseUrlEnv: 'VOLCENGINE_BASE_URL',     modelEnv: 'VOLCENGINE_MODEL',     defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3', defaultModel: 'DeepSeek-V4-Pro' },
    openrouter:    { apiKeyEnv: 'OPENROUTER_API_KEY',      baseUrlEnv: 'OPENROUTER_BASE_URL',     modelEnv: 'OPENROUTER_MODEL',     defaultBaseUrl: 'https://openrouter.ai/api/v1',            defaultModel: 'deepseek/deepseek-v4-pro' },
    novita:        { apiKeyEnv: 'NOVITA_API_KEY',          baseUrlEnv: 'NOVITA_BASE_URL',         modelEnv: 'NOVITA_MODEL',         defaultBaseUrl: 'https://api.novita.ai/v1',                defaultModel: 'deepseek/deepseek-v4-pro' },
    atlascloud:    { apiKeyEnv: 'ATLASCLOUD_API_KEY',      baseUrlEnv: 'ATLASCLOUD_BASE_URL',     modelEnv: 'ATLASCLOUD_MODEL',     defaultBaseUrl: 'https://api.atlascloud.ai/v1',            defaultModel: 'deepseek-ai/deepseek-v4-flash' },
    dashscope:     { apiKeyEnv: 'DASHSCOPE_API_KEY',       baseUrlEnv: 'DASHSCOPE_BASE_URL',      modelEnv: 'DASHSCOPE_MODEL',      defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen3-235b-a22b' },
};

/** 所有支持的 Provider ID 列表 */
export const ALL_PROVIDERS = Object.keys(PROVIDER_ENV_MAP);

/** Provider 凭证信息（从存储中读取） */
export interface ProviderCredentials {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
}

const STORAGE_KEY_PREFIX = 'celest.provider.';
const LEGACY_API_KEY = 'celest.apiKey';
const LEGACY_BASE_URL = 'celest.baseUrl';
const LEGACY_PROVIDER = 'celest.provider';

/**
 * VS Code SecretStorage 封装 — 多 Provider 安全存储。
 * 使用 VS Code 内置的 SecretStorage API（系统级加密，如 macOS Keychain / Windows Credential Manager）。
 */
export class SecretStore {
    constructor(private secrets: vscode.SecretStorage) {}

    // ── Provider 级 API Key ──

    /** 获取指定 Provider 的 API Key */
    async getProviderApiKey(providerId: string): Promise<string | undefined> {
        try {
            return await this.secrets.get(STORAGE_KEY_PREFIX + providerId + '.apiKey');
        } catch (err: any) {
            logger.error(`[SecretStore] getProviderApiKey(${providerId}):`, err.message);
            return undefined;
        }
    }

    /** 存储指定 Provider 的 API Key */
    async setProviderApiKey(providerId: string, key: string): Promise<void> {
        try {
            await this.secrets.store(STORAGE_KEY_PREFIX + providerId + '.apiKey', key);
            logger.info(`[SecretStore] apiKey stored for ${providerId}`);
        } catch (err: any) {
            logger.error(`[SecretStore] setProviderApiKey(${providerId}):`, err.message);
            throw err;
        }
    }

    /** 删除指定 Provider 的 API Key */
    async deleteProviderApiKey(providerId: string): Promise<void> {
        try {
            await this.secrets.delete(STORAGE_KEY_PREFIX + providerId + '.apiKey');
            logger.info(`[SecretStore] apiKey deleted for ${providerId}`);
        } catch (err: any) {
            logger.error(`[SecretStore] deleteProviderApiKey(${providerId}):`, err.message);
        }
    }

    /** 批量获取所有已存储 Provider 的凭证 */
    async getAllProviderCredentials(): Promise<Record<string, ProviderCredentials>> {
        const result: Record<string, ProviderCredentials> = {};
        for (const providerId of ALL_PROVIDERS) {
            const apiKey = await this.getProviderApiKey(providerId);
            if (apiKey) {
                result[providerId] = { apiKey };
            }
        }
        return result;
    }

    // ── 旧版兼容方法（委托到 deepseek Provider） ──

    /** @deprecated 使用 getProviderApiKey('deepseek') */
    async getApiKey(): Promise<string | undefined> {
        return this.getProviderApiKey('deepseek');
    }

    /** @deprecated 使用 setProviderApiKey('deepseek', key) */
    async setApiKey(key: string): Promise<void> {
        return this.setProviderApiKey('deepseek', key);
    }

    /** @deprecated 使用 deleteProviderApiKey('deepseek') */
    async deleteApiKey(): Promise<void> {
        return this.deleteProviderApiKey('deepseek');
    }

    // ── 旧版 Provider / BaseUrl（保留兼容） ──

    async getProvider(): Promise<string | undefined> {
        try { return await this.secrets.get(LEGACY_PROVIDER); } catch { return undefined; }
    }

    async setProvider(provider: string): Promise<void> {
        try { await this.secrets.store(LEGACY_PROVIDER, provider); } catch (err: any) { logger.error('[SecretStore] setProvider:', err.message); }
    }

    async getBaseUrl(): Promise<string | undefined> {
        try { return await this.secrets.get(LEGACY_BASE_URL); } catch { return undefined; }
    }

    async setBaseUrl(url: string): Promise<void> {
        try { await this.secrets.store(LEGACY_BASE_URL, url); } catch (err: any) { logger.error('[SecretStore] setBaseUrl:', err.message); }
    }

    // ── 迁移 ──

    /**
     * 将旧版全局 API Key 迁移到 deepseek Provider。
     * 仅在首次调用时执行一次。
     */
    async migrateLegacyIfNeeded(): Promise<void> {
        const migratedKey = '__celest_migrated_v010';
        try {
            const already = await this.secrets.get(migratedKey);
            if (already) return;
        } catch { /* key doesn't exist yet, proceed */ }

        try {
            const legacyKey = await this.secrets.get(LEGACY_API_KEY);
            if (legacyKey) {
                const existing = await this.getProviderApiKey('deepseek');
                if (!existing) {
                    await this.setProviderApiKey('deepseek', legacyKey);
                    logger.info('[SecretStore] migrated legacy apiKey → deepseek provider');
                }
                await this.secrets.delete(LEGACY_API_KEY);
            }
            await this.secrets.store(migratedKey, '1');
        } catch (err: any) {
            logger.warn('[SecretStore] migration skipped:', err.message);
        }
    }
}

/** 创建单例 */
let _instance: SecretStore | null = null;

export function initSecretStore(context: vscode.ExtensionContext): SecretStore {
    if (!_instance) {
        _instance = new SecretStore(context.secrets);
        // 触发异步迁移（不阻塞启动）
        _instance.migrateLegacyIfNeeded().catch(() => {});
    }
    return _instance;
}

export function getSecretStore(): SecretStore {
    if (!_instance) {
        throw new Error('SecretStore not initialized. Call initSecretStore() first.');
    }
    return _instance;
}
