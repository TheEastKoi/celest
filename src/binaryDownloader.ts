import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import { logger } from './logger';

/** GitHub Release 信息 — codewhale-tui 仓库 */
const GITHUB_RELEASE_API = `https://api.github.com/repos/Hmbown/CodeWhale/releases/latest`;

interface DownloadProgress {
    stage: 'idle' | 'downloading' | 'extracting' | 'verifying' | 'complete' | 'failed';
    percent: number;
    message: string;
}

/**
 * 二进制自动下载器
 * 从 GitHub Release 下载对应平台的 codewhale-tui 二进制文件。
 * 如果下载失败（如 Release 不存在），提示用户手动构建或指定路径。
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

    /** 获取最新 Release 信息 */
    private async getLatestRelease(): Promise<{ tagName: string; downloadUrl: string }> {
        try {
            const resp = await fetch(GITHUB_RELEASE_API, {
                headers: { 'User-Agent': 'celest-vscode-extension' },
            });
            if (!resp.ok) {
                if (resp.status === 404) {
                    throw new Error('No binary release found. Build codewhale-tui from source or set celest.binaryPath in VS Code settings.');
                }
                throw new Error(`GitHub API returned ${resp.status}`);
            }
            const release = await resp.json() as any;
            const tagName = release.tag_name || 'unknown';
            
            const platformName = this.getPlatformBinaryName();
            const assets: any[] = release.assets || [];
            const asset = assets.find((a: any) => a.name === platformName);
            
            if (!asset) {
                const partial = assets.find((a: any) => 
                    a.name.includes(os.platform()) && a.name.includes(os.arch())
                );
                if (!partial) {
                    throw new Error(`No binary for ${platformName}. Available: ${assets.map((a: any) => a.name).join(', ')}`);
                }
                return { tagName, downloadUrl: partial.browser_download_url };
            }
            
            return { tagName, downloadUrl: asset.browser_download_url };
        } catch (err: any) {
            logger.error('[BinaryDownloader] getLatestRelease:', err.message);
            throw err;
        }
    }

    /** 下载二进制文件 */
    async download(force = false): Promise<string> {
        const binPath = this.getLocalBinaryPath();
        
        // 如果已存在且不强制，直接返回
        if (!force && fs.existsSync(binPath)) {
            logger.info('[BinaryDownloader] binary already exists:', binPath);
            this._onProgress.fire({ stage: 'complete', percent: 100, message: 'Already exists' });
            return binPath;
        }
        
        // 强制下载时保存到新文件（旧文件可能正在运行）
        const targetPath = force ? (binPath + '.new') : binPath;

        try {
            this._onProgress.fire({ stage: 'downloading', percent: 0, message: 'Fetching release info...' });
            
            const release = await this.getLatestRelease();
            logger.info('[BinaryDownloader] downloading from:', release.downloadUrl);
            
            this._onProgress.fire({ stage: 'downloading', percent: 5, message: `Downloading codewhale-tui ${release.tagName}...` });
            
            const resp = await fetch(release.downloadUrl);
            if (!resp.ok) {
                throw new Error(`Download failed: HTTP ${resp.status}`);
            }
            
            const contentLength = Number(resp.headers.get('content-length') || '0');
            const reader = resp.body?.getReader();
            if (!reader) throw new Error('No response body');
            
            const tmpPath = targetPath + '.tmp';
            const chunks: Uint8Array[] = [];
            let downloaded = 0;
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                downloaded += value.length;
                
                if (contentLength > 0) {
                    const pct = Math.round(5 + (downloaded / contentLength) * 75);
                    this._onProgress.fire({ stage: 'downloading', percent: pct, message: `Downloading... ${Math.round(downloaded / 1024 / 1024)}MB` });
                }
            }
            
            const buffer = Buffer.concat(chunks);
            fs.writeFileSync(tmpPath, buffer);
            
            this._onProgress.fire({ stage: 'extracting', percent: 85, message: 'Extracting...' });
            
            fs.renameSync(tmpPath, targetPath);
            
            if (os.platform() !== 'win32') {
                fs.chmodSync(targetPath, 0o755);
            }
            
            this._onProgress.fire({ stage: 'verifying', percent: 95, message: 'Verifying...' });
            
            if (!fs.existsSync(targetPath)) {
                throw new Error('Binary file not found after download');
            }
            
            const stat = fs.statSync(targetPath);
            if (stat.size < 1000) {
                throw new Error('Binary file too small');
            }
            
            this._onProgress.fire({ stage: 'complete', percent: 100, message: 'Download complete' });
            logger.info('[BinaryDownloader] download complete:', targetPath, `(${stat.size} bytes)`);
            
            await vscode.workspace.getConfiguration('celest').update('binaryPath', targetPath, true);
            
            return targetPath;
        } catch (err: any) {
            logger.error('[BinaryDownloader] download failed:', err.message);
            this._onProgress.fire({ stage: 'failed', percent: 0, message: err.message });
            // 清理临时文件
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
            logger.error('[BinaryDownloader] checkUpdate:', err.message);
            return { hasUpdate: false };
        }
    }

    /** 查找可用的二进制文件路径 */
    findBinary(): string | null {
        // 1. 用户配置的路径
        const configPath = vscode.workspace.getConfiguration('celest').get<string>('binaryPath');
        if (configPath && fs.existsSync(configPath)) return configPath;
        
        // 2. 本地下载的二进制
        const localPath = this.getLocalBinaryPath();
        if (fs.existsSync(localPath)) return localPath;
        
        // 3. 开发环境路径
        if (os.platform() === 'win32') {
            const devCandidates = [
                path.join('E:', 'git_code', 'DeepSeek-TUI-new', 'target', 'release', 'codewhale-tui.exe'),
                path.join('E:', 'git_code', 'DeepSeek-TUI-new', 'target', 'debug', 'codewhale-tui.exe'),
            ];
            for (const c of devCandidates) {
                if (fs.existsSync(c)) return c;
            }
        }
        
        // 4. PATH 中的全局二进制
        if (this.hasGlobalBinary()) {
            return 'codewhale-tui';
        }
        
        return null;
    }
}
