import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as http from 'node:http';
import * as https from 'node:https';
import * as crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { logger } from './logger';

// ── Phase 1: 多源下载 + 镜像支持 ──

interface DownloadSource {
    name: string;
    /** 获取最新 release 信息的 URL */
    releaseApiUrl?: string;
    /** 直接下载 URL 模板（{tag} 和 {asset} 占位符） */
    downloadUrlTemplate?: string;
    /** 直接下载基础 URL */
    directBaseUrl?: string;
}

const DOWNLOAD_SOURCES: DownloadSource[] = [
    {
        name: 'github-api',
        releaseApiUrl: 'https://api.github.com/repos/Hmbown/CodeWhale/releases/latest',
    },
    {
        name: 'github-release',
        downloadUrlTemplate: 'https://github.com/Hmbown/CodeWhale/releases/latest/download/{asset}',
    },
    {
        name: 'cnb-mirror',
        downloadUrlTemplate: 'https://cnb.cool/codewhale.net/codewhale/releases/latest/download/{asset}',
    },
];

interface DownloadProgress {
    stage: 'idle' | 'downloading' | 'extracting' | 'verifying' | 'complete' | 'failed';
    percent: number;
    message: string;
}

interface ReleaseInfo {
    tagName: string;
    downloadUrl: string;
    source: string;
}

/** 可重试的错误特征 */
const RETRYABLE_ERRORS = ['ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ERR_STREAM_PREMATURE_CLOSE'];
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1s

function isRetryable(err: any): boolean {
    if (err?.code && RETRYABLE_ERRORS.includes(err.code)) return true;
    // HTTP 5xx
    if (err?.status && err.status >= 500 && err.status < 600) return true;
    return false;
}

/**
 * Phase 1: 二进制自动下载器（重构版）
 *
 * 特性：
 * - 多源链式回退（GitHub API → GitHub Release → CNB 镜像 → 环境变量自定义）
 * - 指数退避重试（最多 5 次，1s→2s→4s→8s→16s）
 * - SHA-256 校验和验证
 * - 代理支持（HTTPS_PROXY/HTTP_PROXY 环境变量）
 * - 移除硬编码开发者路径
 */
export class BinaryDownloader {
    private _onProgress = new vscode.EventEmitter<DownloadProgress>();
    readonly onProgress = this._onProgress.event;

    constructor(private context: vscode.ExtensionContext) {}

    /** 获取平台对应的二进制文件名 */
    private getPlatformBinaryName(): string {
        const platform = os.platform();
        const arch = os.arch();
        const ext = platform === 'win32' ? '.exe' : '';

        let platformName: string;
        switch (platform) {
            case 'win32': platformName = 'windows'; break;
            case 'darwin': platformName = 'macos'; break;
            case 'linux': platformName = 'linux'; break;
            default: throw new Error(`Unsupported platform: ${platform}`);
        }

        let archName: string;
        switch (arch) {
            case 'x64': archName = 'x64'; break;
            case 'arm64': archName = 'arm64'; break;
            default: archName = arch;
        }

        return `codewhale-tui-${platformName}-${archName}${ext}`;
    }

    /** 获取本地存储二进制文件的目录 */
    private getStorageDir(): string {
        const dir = path.join(this.context.globalStorageUri.fsPath, 'binary');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    }

    /** 获取本地二进制文件路径 */
    getLocalBinaryPath(): string {
        const name = this.getPlatformBinaryName();
        return path.join(this.getStorageDir(), name);
    }

    /** 检查本地是否已有二进制 */
    hasLocalBinary(): boolean {
        return fs.existsSync(this.getLocalBinaryPath());
    }

    /** 检查全局 PATH 中是否有 codewhale-tui */
    hasGlobalBinary(): boolean {
        try {
            const cmd = os.platform() === 'win32' ? 'where codewhale-tui' : 'which codewhale-tui';
            execSync(cmd, { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    }

    // ── 代理支持 ──

    /** 获取代理配置的 fetch agent（用于 https.Agent 通过 proxy 连接） */
    private getProxyAgent(): http.Agent | undefined {
        const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;
        if (!proxyUrl) return undefined;

        try {
            const url = new URL(proxyUrl);
            // 使用 Node.js 内置的隧道代理（通过 CONNECT 方法）
            const HttpsProxyAgent = require('https-proxy-agent');
            return new HttpsProxyAgent.HttpsProxyAgent(proxyUrl);
        } catch {
            logger.warn('[BinaryDownloader] invalid proxy URL, ignoring');
            return undefined;
        }
    }

    /** 创建 fetch init 选项，包含代理配置 */
    private createFetchInit(signal?: AbortSignal): RequestInit {
        const init: RequestInit & { agent?: any } = {
            headers: { 'User-Agent': 'celest-vscode-extension' },
            signal,
        };

        // 尝试使用代理
        const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;
        if (proxyUrl) {
            try {
                // 动态加载 https-proxy-agent（如果可用）
                const HttpsProxyAgent = require('https-proxy-agent');
                if (HttpsProxyAgent?.HttpsProxyAgent) {
                    (init as any).agent = new HttpsProxyAgent.HttpsProxyAgent(proxyUrl);
                    logger.info('[BinaryDownloader] using proxy:', proxyUrl);
                }
            } catch {
                // https-proxy-agent 可能不可用，静默回退
            }
        }

        return init;
    }

    // ── 校验和验证 ──

    /** 下载校验和清单并验证二进制文件 */
    private async verifyChecksum(filePath: string, tagName: string): Promise<boolean> {
        const assetName = this.getPlatformBinaryName();
        const checksumUrls = [
            `https://github.com/Hmbown/CodeWhale/releases/download/${tagName}/codewhale-artifacts-sha256.txt`,
            `https://cnb.cool/codewhale.net/codewhale/releases/download/${tagName}/codewhale-artifacts-sha256.txt`,
        ];

        let manifest: string | null = null;
        for (const url of checksumUrls) {
            try {
                const resp = await fetch(url, this.createFetchInit());
                if (resp.ok) {
                    manifest = await resp.text();
                    logger.info('[BinaryDownloader] checksum manifest downloaded from:', url);
                    break;
                }
            } catch { /* try next source */ }
        }

        if (!manifest) {
            logger.warn('[BinaryDownloader] checksum manifest not available, skipping verification');
            return true; // 没有校验和文件时不阻塞下载
        }

        // 在 manifest 中查找对应文件的 SHA-256
        const escapedName = assetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`^([0-9a-fA-F]{64})\\s+${escapedName}$`, 'm');
        const match = manifest.match(re);
        if (!match) {
            logger.warn('[BinaryDownloader] checksum entry not found for:', assetName);
            return true;
        }

        const expected = match[1].toLowerCase();
        const actual = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

        if (expected !== actual) {
            logger.error('[BinaryDownloader] checksum mismatch! expected:', expected, 'actual:', actual);
            return false;
        }

        logger.info('[BinaryDownloader] checksum verified ✓');
        return true;
    }

    // ── 重试机制 ──

    /** 带指数退避的重试 fetch */
    private async fetchWithRetry(url: string, init: RequestInit, maxRetries = MAX_RETRIES): Promise<Response> {
        let lastError: any;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const resp = await fetch(url, init);
                if (resp.ok || (resp.status >= 400 && resp.status < 500)) {
                    return resp; // 成功或客户端错误不重试
                }
                lastError = { status: resp.status, message: `HTTP ${resp.status}` };
                if (!isRetryable(lastError)) return resp;
            } catch (err: any) {
                lastError = err;
                if (!isRetryable(err)) throw err;
            }

            if (attempt < maxRetries - 1) {
                const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
                logger.info(`[BinaryDownloader] retry ${attempt + 1}/${maxRetries} in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
        throw lastError;
    }

    // ── 多源 release 信息获取 ──

    /** 尝试从多个源获取最新 release 信息 */
    private async getLatestReleaseFromSource(source: DownloadSource): Promise<ReleaseInfo | null> {
        const platformName = this.getPlatformBinaryName();
        const tagOverride = process.env.DEEPSEEK_TUI_RELEASE_BASE_URL;
        const versionOverride = vscode.workspace.getConfiguration('celest').get<string>('releaseVersion') || '';

        // 1. 如果 source 有 releaseApiUrl，通过 API 获取
        if (source.releaseApiUrl) {
            try {
                const resp = await this.fetchWithRetry(source.releaseApiUrl, this.createFetchInit());
                const release = await resp.json() as any;
                const tagName = versionOverride || release.tag_name || 'latest';
                const assets: any[] = release.assets || [];

                // 精确匹配平台二进制名
                let asset = assets.find((a: any) => a.name === platformName);
                // 模糊匹配
                if (!asset) {
                    asset = assets.find((a: any) =>
                        a.name.includes(os.platform()) && a.name.includes(os.arch()));
                }
                if (!asset) {
                    logger.warn('[BinaryDownloader] no asset for', platformName, 'in', source.name);
                    return null;
                }

                return {
                    tagName,
                    downloadUrl: asset.browser_download_url,
                    source: source.name,
                };
            } catch (err: any) {
                logger.warn('[BinaryDownloader]', source.name, 'failed:', err.message);
                return null;
            }
        }

        // 2. 如果 source 有 downloadUrlTemplate，构造 URL
        if (source.downloadUrlTemplate) {
            const tag = versionOverride || 'latest';
            const url = source.downloadUrlTemplate.replace('{asset}', platformName).replace('{tag}', tag);

            // 快速检查 URL 是否可访问（HEAD 请求）
            try {
                const resp = await fetch(url, { method: 'HEAD', ...this.createFetchInit() });
                if (resp.ok || resp.status === 302 || resp.status === 301) {
                    return { tagName: tag, downloadUrl: url, source: source.name };
                }
            } catch (err: any) {
                logger.warn('[BinaryDownloader]', source.name, 'HEAD failed:', err.message);
            }
        }

        return null;
    }

    /** 从所有源获取 release 信息（链式回退） */
    private async getLatestRelease(): Promise<ReleaseInfo> {
        // 环境变量自定义源
        const envUrl = process.env.DEEPSEEK_TUI_RELEASE_BASE_URL;
        if (envUrl) {
            const platformName = this.getPlatformBinaryName();
            const tag = vscode.workspace.getConfiguration('celest').get<string>('releaseVersion') || 'latest';
            return {
                tagName: tag,
                downloadUrl: `${envUrl.replace(/\/$/, '')}/${platformName}`,
                source: 'env-override',
            };
        }

        // 链式回退
        for (const source of DOWNLOAD_SOURCES) {
            this._onProgress.fire({
                stage: 'downloading',
                percent: Math.round(5 * (DOWNLOAD_SOURCES.indexOf(source) + 1) / DOWNLOAD_SOURCES.length),
                message: `Trying ${source.name}...`,
            });

            const info = await this.getLatestReleaseFromSource(source);
            if (info) {
                logger.info('[BinaryDownloader] using source:', info.source, '→', info.downloadUrl);
                return info;
            }
        }

        throw new Error(
            'No binary release found from any source.\n\n' +
            'Available sources: ' + DOWNLOAD_SOURCES.map(s => s.name).join(', ') + '\n\n' +
            'Set celest.binaryPath in VS Code settings or set DEEPSEEK_TUI_RELEASE_BASE_URL env var.'
        );
    }

    // ── 下载流程 ──

    /** 下载二进制文件 */
    async download(force = false): Promise<string> {
        const binPath = this.getLocalBinaryPath();

        // 如果已存在且不强制，直接返回
        if (!force && fs.existsSync(binPath) && fs.statSync(binPath).size >= 1000) {
            logger.info('[BinaryDownloader] binary already exists:', binPath);
            this._onProgress.fire({ stage: 'complete', percent: 100, message: 'Already exists' });
            return binPath;
        }

        const targetPath = force ? (binPath + '.new') : binPath;
        const tmpPath = targetPath + '.tmp';

        try {
            this._onProgress.fire({ stage: 'downloading', percent: 0, message: 'Fetching release info...' });

            const release = await this.getLatestRelease();
            logger.info('[BinaryDownloader] downloading from:', release.downloadUrl, '(source:', release.source, ')');

            this._onProgress.fire({
                stage: 'downloading',
                percent: 10,
                message: `Downloading codewhale-tui ${release.tagName} (${release.source})...`,
            });

            // 下载文件
            const resp = await this.fetchWithRetry(release.downloadUrl, this.createFetchInit());

            const contentLength = Number(resp.headers.get('content-length') || '0');
            const reader = resp.body?.getReader();
            if (!reader) throw new Error('No response body');

            const chunks: Uint8Array[] = [];
            let downloaded = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                downloaded += value.length;

                if (contentLength > 0) {
                    const pct = Math.round(10 + (downloaded / contentLength) * 70);
                    this._onProgress.fire({
                        stage: 'downloading',
                        percent: pct,
                        message: `Downloading... ${Math.round(downloaded / 1024 / 1024)}MB`,
                    });
                }
            }

            // 写入临时文件
            const buffer = Buffer.concat(chunks);
            fs.writeFileSync(tmpPath, buffer);

            this._onProgress.fire({ stage: 'verifying', percent: 85, message: 'Verifying checksum...' });

            // SHA-256 校验
            const checksumOk = await this.verifyChecksum(tmpPath, release.tagName);
            if (!checksumOk) {
                try { fs.unlinkSync(tmpPath); } catch { /* */ }
                throw new Error('Checksum verification failed. The downloaded binary may be corrupted.');
            }

            // 移动到目标位置
            this._onProgress.fire({ stage: 'extracting', percent: 90, message: 'Installing...' });

            // 删除旧的 .new 文件（如果存在）
            if (fs.existsSync(targetPath)) {
                fs.unlinkSync(targetPath);
            }
            fs.renameSync(tmpPath, targetPath);

            // Unix: 设置可执行权限
            if (os.platform() !== 'win32') {
                fs.chmodSync(targetPath, 0o755);
            }

            this._onProgress.fire({ stage: 'verifying', percent: 95, message: 'Verifying...' });

            if (!fs.existsSync(targetPath)) {
                throw new Error('Binary file not found after download');
            }

            const stat = fs.statSync(targetPath);
            if (stat.size < 1000) {
                throw new Error('Binary file too small (' + stat.size + ' bytes)');
            }

            this._onProgress.fire({ stage: 'complete', percent: 100, message: 'Download complete' });
            logger.info('[BinaryDownloader] download complete:', targetPath, `(${stat.size} bytes from ${release.source})`);

            // 更新配置
            await vscode.workspace.getConfiguration('celest').update('binaryPath', targetPath, true);

            return targetPath;
        } catch (err: any) {
            logger.error('[BinaryDownloader] download failed:', err.message);
            this._onProgress.fire({ stage: 'failed', percent: 0, message: err.message });
            // 清理临时文件
            try { fs.unlinkSync(tmpPath); } catch { /* */ }
            try { fs.unlinkSync(targetPath + '.tmp'); } catch { /* */ }
            throw err;
        }
    }

    /** 检查更新 */
    async checkUpdate(): Promise<{ hasUpdate: boolean; latestVersion?: string; currentVersion?: string }> {
        try {
            const release = await this.getLatestRelease();
            let currentVersion = 'unknown';
            try {
                const binPath = this.findBinary();
                if (binPath && fs.existsSync(binPath)) {
                    const output = execSync(`"${binPath}" --version`, { encoding: 'utf-8', timeout: 5000 });
                    currentVersion = output.trim();
                }
            } catch { /* ignore */ }

            return {
                hasUpdate: !currentVersion.includes(release.tagName.replace(/^v/, '')),
                latestVersion: release.tagName,
                currentVersion,
            };
        } catch (err: any) {
            logger.error('[BinaryDownloader] checkUpdate failed:', err.message);
            return { hasUpdate: false };
        }
    }

    /** 查找可用的二进制文件路径（Phase 1: 移除硬编码开发者路径） */
    findBinary(): string | null {
        // 1. 用户配置的路径
        const configPath = vscode.workspace.getConfiguration('celest').get<string>('binaryPath');
        if (configPath && fs.existsSync(configPath)) return configPath;

        // 2. 本地下载的二进制
        const localPath = this.getLocalBinaryPath();
        if (fs.existsSync(localPath)) return localPath;

        // 3. PATH 中的全局二进制
        if (this.hasGlobalBinary()) {
            return 'codewhale-tui';
        }

        // 4. npm 全局安装
        try {
            const npmRoot = execSync('npm root -g', { encoding: 'utf-8', timeout: 5000 }).trim();
            if (npmRoot) {
                const npmBinPath = path.join(npmRoot, '.bin', os.platform() === 'win32' ? 'codewhale-tui.exe' : 'codewhale-tui');
                if (fs.existsSync(npmBinPath)) return npmBinPath;
            }
        } catch { /* ignore */ }

        // 5. npx 可用性（通过 which/where 检查）
        try {
            const cmd = os.platform() === 'win32' ? 'where codewhale-tui' : 'which codewhale-tui';
            const result = execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim();
            if (result && fs.existsSync(result)) return result;
        } catch { /* ignore */ }

        return null;
    }
}
