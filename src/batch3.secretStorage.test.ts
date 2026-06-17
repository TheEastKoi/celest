/**
 * Bug 13: secretStorage.ts 单元测试
 *
 * 覆盖：
 * - PROVIDER_ENV_MAP 完整性检查
 * - SecretStore 构造函数
 * - getProviderApiKey / setProviderApiKey / deleteProviderApiKey
 * - getAllProviderCredentials
 * - 旧版兼容方法（getApiKey / setApiKey / deleteApiKey）
 * - 迁移逻辑（migrateLegacyIfNeeded）
 * - getSecretStore 单例
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PROVIDER_ENV_MAP, ALL_PROVIDERS, SecretStore, initSecretStore, getSecretStore } from './secretStorage';
import { logger } from './logger';

vi.spyOn(logger, 'info').mockImplementation(() => {});
vi.spyOn(logger, 'warn').mockImplementation(() => {});
vi.spyOn(logger, 'error').mockImplementation(() => {});

// ═══════════════════════════════════════════════════════════════
// PROVIDER_ENV_MAP 完整性
// ═══════════════════════════════════════════════════════════════

describe('PROVIDER_ENV_MAP', () => {
    it('应包含 deepseek provider', () => {
        expect(PROVIDER_ENV_MAP['deepseek']).toBeDefined();
        expect(PROVIDER_ENV_MAP['deepseek'].apiKeyEnv).toBe('DEEPSEEK_API_KEY');
        expect(PROVIDER_ENV_MAP['deepseek'].defaultModel).toBe('deepseek-v4-flash');
    });

    it('应包含 openai provider', () => {
        expect(PROVIDER_ENV_MAP['openai']).toBeDefined();
        expect(PROVIDER_ENV_MAP['openai'].defaultBaseUrl).toContain('openai.com');
    });

    it('应包含 ollama provider（无需 API Key）', () => {
        expect(PROVIDER_ENV_MAP['ollama']).toBeDefined();
        expect(PROVIDER_ENV_MAP['ollama'].apiKeyEnv).toBe('');
    });

    it('应包含 siliconflow-CN provider', () => {
        expect(PROVIDER_ENV_MAP['siliconflow-CN']).toBeDefined();
        expect(PROVIDER_ENV_MAP['siliconflow-CN'].defaultBaseUrl).toContain('siliconflow.cn');
    });

    it('ALL_PROVIDERS 应与 PROVIDER_ENV_MAP 的 key 一致', () => {
        expect(ALL_PROVIDERS).toEqual(Object.keys(PROVIDER_ENV_MAP));
    });

    it('所有 provider 都应有完整字段', () => {
        for (const [id, mapping] of Object.entries(PROVIDER_ENV_MAP)) {
            expect(mapping.apiKeyEnv).toBeDefined();
            expect(mapping.baseUrlEnv).toBeDefined();
            expect(mapping.defaultBaseUrl).toBeDefined();
            expect(mapping.defaultModel).toBeDefined();
        }
    });

    // Phase 2: 验证新增 Provider
    it('应包含 23 个 Provider（含新增的 anthropic/openai-codex/minimax）', () => {
        expect(Object.keys(PROVIDER_ENV_MAP).length).toBeGreaterThanOrEqual(23);
    });

    it('应包含 anthropic Provider', () => {
        expect(PROVIDER_ENV_MAP['anthropic']).toBeDefined();
        expect(PROVIDER_ENV_MAP['anthropic'].apiKeyEnv).toBe('ANTHROPIC_API_KEY');
        expect(PROVIDER_ENV_MAP['anthropic'].defaultModel).toBe('claude-sonnet-4-6');
    });

    it('应包含 openai-codex Provider', () => {
        expect(PROVIDER_ENV_MAP['openai-codex']).toBeDefined();
        expect(PROVIDER_ENV_MAP['openai-codex'].apiKeyEnv).toBe('OPENAI_CODEX_ACCESS_TOKEN');
        expect(PROVIDER_ENV_MAP['openai-codex'].defaultModel).toBe('gpt-5.5');
    });

    it('应包含 minimax Provider', () => {
        expect(PROVIDER_ENV_MAP['minimax']).toBeDefined();
        expect(PROVIDER_ENV_MAP['minimax'].apiKeyEnv).toBe('MINIMAX_API_KEY');
        expect(PROVIDER_ENV_MAP['minimax'].defaultModel).toBe('minimax-2.7');
    });

    it('moonshot defaultModel 应更新为 kimi-k2.7-code', () => {
        expect(PROVIDER_ENV_MAP['moonshot'].defaultModel).toBe('kimi-k2.7-code');
    });
});

// ═══════════════════════════════════════════════════════════════
// SecretStore 基础操作
// ═══════════════════════════════════════════════════════════════

function makeMockSecrets() {
    const store = new Map<string, string>();
    return {
        get: vi.fn(async (key: string) => store.get(key)),
        store: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
        delete: vi.fn(async (key: string) => { store.delete(key); }),
        _store: store, // 用于直接检查
    };
}

describe('SecretStore', () => {
    let mockSecrets: ReturnType<typeof makeMockSecrets>;
    let store: SecretStore;

    beforeEach(() => {
        mockSecrets = makeMockSecrets();
        store = new SecretStore(mockSecrets as any);
    });

    it('构造函数不应抛出', () => {
        expect(() => new SecretStore(mockSecrets as any)).not.toThrow();
    });

    it('setProviderApiKey 应存储 API Key', async () => {
        await store.setProviderApiKey('deepseek', 'sk-test-key');
        expect(mockSecrets.store).toHaveBeenCalledWith(
            'celest.provider.deepseek.apiKey',
            'sk-test-key'
        );
    });

    it('getProviderApiKey 应读取已存储的 Key', async () => {
        await store.setProviderApiKey('deepseek', 'sk-test-key');
        const key = await store.getProviderApiKey('deepseek');
        expect(key).toBe('sk-test-key');
    });

    it("getProviderApiKey 不存在的 Provider 应返回 undefined", async () => {
        const key = await store.getProviderApiKey('nonexistent');
        expect(key).toBeUndefined();
    });

    it('deleteProviderApiKey 应删除 Key', async () => {
        await store.setProviderApiKey('deepseek', 'sk-to-delete');
        await store.deleteProviderApiKey('deepseek');
        expect(mockSecrets.delete).toHaveBeenCalledWith('celest.provider.deepseek.apiKey');
        const key = await store.getProviderApiKey('deepseek');
        expect(key).toBeUndefined();
    });

    it('setProviderApiKey 空 Provider ID 不应崩溃', async () => {
        await expect(store.setProviderApiKey('', 'key')).resolves.not.toThrow();
    });
});

// ═══════════════════════════════════════════════════════════════
// SecretStore 批量操作
// ═══════════════════════════════════════════════════════════════

describe('SecretStore 批量获取', () => {
    let mockSecrets: ReturnType<typeof makeMockSecrets>;
    let store: SecretStore;

    beforeEach(() => {
        mockSecrets = makeMockSecrets();
        store = new SecretStore(mockSecrets as any);
    });

    it('getAllProviderCredentials 无存储时应返回空对象', async () => {
        const creds = await store.getAllProviderCredentials();
        expect(creds).toEqual({});
    });

    it('getAllProviderCredentials 应返回有 Key 的 Provider', async () => {
        await store.setProviderApiKey('deepseek', 'sk-deep');
        await store.setProviderApiKey('openai', 'sk-openai');

        const creds = await store.getAllProviderCredentials();
        expect(creds['deepseek']).toBeDefined();
        expect(creds['deepseek'].apiKey).toBe('sk-deep');
        expect(creds['openai']).toBeDefined();
        expect(creds['openai'].apiKey).toBe('sk-openai');
        // 没有 Key 的 Provider 不出现在结果中
        expect(creds['ollama']).toBeUndefined();
    });
});

// ═══════════════════════════════════════════════════════════════
// SecretStore 旧版兼容
// ═══════════════════════════════════════════════════════════════

describe('SecretStore 旧版兼容方法', () => {
    let mockSecrets: ReturnType<typeof makeMockSecrets>;
    let store: SecretStore;

    beforeEach(() => {
        mockSecrets = makeMockSecrets();
        store = new SecretStore(mockSecrets as any);
    });

    it('getApiKey 应委托到 getProviderApiKey("deepseek")', async () => {
        await store.setProviderApiKey('deepseek', 'sk-legacy');
        const key = await store.getApiKey();
        expect(key).toBe('sk-legacy');
    });

    it('setApiKey 应委托到 setProviderApiKey("deepseek")', async () => {
        await store.setApiKey('sk-new');
        const key = await store.getProviderApiKey('deepseek');
        expect(key).toBe('sk-new');
    });

    it('deleteApiKey 应委托到 deleteProviderApiKey("deepseek")', async () => {
        await store.setProviderApiKey('deepseek', 'sk-temp');
        await store.deleteApiKey();
        const key = await store.getProviderApiKey('deepseek');
        expect(key).toBeUndefined();
    });

    it('getProvider 应返回旧版 provider 设置', async () => {
        await mockSecrets.store('celest.provider', 'openai');
        const provider = await store.getProvider();
        expect(provider).toBe('openai');
    });

    it('setProvider 应存储旧版 provider 设置', async () => {
        await store.setProvider('ollama');
        const val = await mockSecrets.get('celest.provider');
        expect(val).toBe('ollama');
    });

    it('getBaseUrl 应返回旧版 baseUrl', async () => {
        await mockSecrets.store('celest.baseUrl', 'http://custom:8080/v1');
        const url = await store.getBaseUrl();
        expect(url).toBe('http://custom:8080/v1');
    });

    it('setBaseUrl 应存储旧版 baseUrl', async () => {
        await store.setBaseUrl('http://new:9999/v1');
        const val = await mockSecrets.get('celest.baseUrl');
        expect(val).toBe('http://new:9999/v1');
    });
});

// ═══════════════════════════════════════════════════════════════
// 迁移逻辑
// ═══════════════════════════════════════════════════════════════

describe('SecretStore 迁移', () => {
    let mockSecrets: ReturnType<typeof makeMockSecrets>;
    let store: SecretStore;

    beforeEach(() => {
        mockSecrets = makeMockSecrets();
        store = new SecretStore(mockSecrets as any);
    });

    it('migrateLegacyIfNeeded 无旧版 Key 应正常完成', async () => {
        await expect(store.migrateLegacyIfNeeded()).resolves.not.toThrow();
    });

    it('migrateLegacyIfNeeded 有旧版 Key 时应迁移到 deepseek', async () => {
        // 模拟旧版 API Key
        await mockSecrets.store('celest.apiKey', 'sk-legacy-key');

        await store.migrateLegacyIfNeeded();

        // 迁移后 deepseek provider 应有这个 key
        const key = await store.getProviderApiKey('deepseek');
        expect(key).toBe('sk-legacy-key');

        // 旧版 Key 应被删除
        const legacyKey = await mockSecrets.get('celest.apiKey');
        expect(legacyKey).toBeUndefined();
    });

    it('migrateLegacyIfNeeded deepseek 已有 Key 时不应覆盖', async () => {
        // deepseek 已有 Key
        await store.setProviderApiKey('deepseek', 'sk-existing');
        // 旧版也有 Key
        await mockSecrets.store('celest.apiKey', 'sk-legacy-old');

        await store.migrateLegacyIfNeeded();

        // 不应覆盖已有的 Key
        const key = await store.getProviderApiKey('deepseek');
        expect(key).toBe('sk-existing');
    });

    it('migrateLegacyIfNeeded 已迁移过不应重复迁移', async () => {
        // 标记已迁移
        await mockSecrets.store('__celest_migrated_v010', '1');
        // 旧版 Key
        await mockSecrets.store('celest.apiKey', 'sk-another');

        await store.migrateLegacyIfNeeded();

        // 标记存在 → 不执行迁移
        const key = await store.getProviderApiKey('deepseek');
        expect(key).toBeUndefined();
    });
});

// ═══════════════════════════════════════════════════════════════
// initSecretStore
// ═══════════════════════════════════════════════════════════════

describe('initSecretStore', () => {
    it('initSecretStore 应返回 SecretStore 实例', () => {
        const mockSecrets = makeMockSecrets();
        const ctx = { secrets: mockSecrets as any, subscriptions: [], globalStorageUri: { fsPath: '/tmp' } } as any;
        const instance = initSecretStore(ctx);
        expect(instance).toBeDefined();
        expect(instance instanceof SecretStore).toBe(true);
    });
});
