import * as vscode from 'vscode';
import { logger } from './logger';

const STORAGE_KEYS = {
    apiKey: 'celest.apiKey',
    provider: 'celest.provider',
    baseUrl: 'celest.baseUrl',
} as const;

/**
 * VS Code SecretStorage 封装 — 安全存储 API Key 等敏感信息。
 * 使用 VS Code 内置的 SecretStorage API（系统级加密，如 macOS Keychain / Windows Credential Manager）。
 */
export class SecretStore {
    constructor(private secrets: vscode.SecretStorage) {}

    /** 获取存储的 API Key */
    async getApiKey(): Promise<string | undefined> {
        try {
            return await this.secrets.get(STORAGE_KEYS.apiKey);
        } catch (err: any) {
            logger.error('[SecretStore] getApiKey:', err.message);
            return undefined;
        }
    }

    /** 存储 API Key */
    async setApiKey(key: string): Promise<void> {
        try {
            await this.secrets.store(STORAGE_KEYS.apiKey, key);
            logger.info('[SecretStore] apiKey stored');
        } catch (err: any) {
            logger.error('[SecretStore] setApiKey:', err.message);
            throw err;
        }
    }

    /** 删除 API Key */
    async deleteApiKey(): Promise<void> {
        try {
            await this.secrets.delete(STORAGE_KEYS.apiKey);
            logger.info('[SecretStore] apiKey deleted');
        } catch (err: any) {
            logger.error('[SecretStore] deleteApiKey:', err.message);
        }
    }

    /** 获取 Provider */
    async getProvider(): Promise<string | undefined> {
        try {
            return await this.secrets.get(STORAGE_KEYS.provider);
        } catch {
            return undefined;
        }
    }

    /** 存储 Provider */
    async setProvider(provider: string): Promise<void> {
        try {
            await this.secrets.store(STORAGE_KEYS.provider, provider);
        } catch (err: any) {
            logger.error('[SecretStore] setProvider:', err.message);
        }
    }

    /** 获取 Base URL */
    async getBaseUrl(): Promise<string | undefined> {
        try {
            return await this.secrets.get(STORAGE_KEYS.baseUrl);
        } catch {
            return undefined;
        }
    }

    /** 存储 Base URL */
    async setBaseUrl(url: string): Promise<void> {
        try {
            await this.secrets.store(STORAGE_KEYS.baseUrl, url);
        } catch (err: any) {
            logger.error('[SecretStore] setBaseUrl:', err.message);
        }
    }
}

/** 创建单例 */
let _instance: SecretStore | null = null;

export function initSecretStore(context: vscode.ExtensionContext): SecretStore {
    if (!_instance) {
        _instance = new SecretStore(context.secrets);
    }
    return _instance;
}

export function getSecretStore(): SecretStore {
    if (!_instance) {
        throw new Error('SecretStore not initialized. Call initSecretStore() first.');
    }
    return _instance;
}
