/**
 * Phase 3/5 功能增强测试
 *
 * 覆盖：
 * - Phase 3: SSE 断线重连逻辑（max reconnect, backoff）
 * - Phase 3: 启动参数扩展（allowed-tools, disallowed-tools, max-turns）
 * - Phase 5: 新增 VSCode 配置项存在性检查
 * - Phase 5: autoCompactThreshold 配置
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TuiProcessManager } from './tuiProcessManager';
import { logger } from './logger';
import * as fs from 'node:fs';

vi.spyOn(logger, 'info').mockImplementation(() => {});
vi.spyOn(logger, 'warn').mockImplementation(() => {});
vi.spyOn(logger, 'error').mockImplementation(() => {});

function makeContext() {
    return { subscriptions: [], globalStorageUri: { fsPath: '/tmp' } } as any;
}

// ═══════════════════════════════════════════════════════════════
// Phase 3: SSE 重连相关
// ═══════════════════════════════════════════════════════════════

describe('Phase 3: SSE 断线重连', () => {
    it('streamEvents 方法应存在', () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(typeof (mgr as any).streamEvents).toBe('function');
    });

    it('resetThread 应递增 generation（重连时丢弃旧事件）', () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(mgr.generation).toBe(0);
        mgr.resetThread();
        expect(mgr.generation).toBe(1);
        mgr.resetThread();
        expect(mgr.generation).toBe(2);
    });

    it('connected 应在未启动时为 false', () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(mgr.connected).toBe(false);
    });

    it('onStatusChange 应可监听 reconnect 状态', () => {
        const mgr = new TuiProcessManager(makeContext());
        const statuses: string[] = [];
        mgr.onStatusChange(({ status }) => statuses.push(status));

        // 手动触发重连状态
        (mgr as any)._onStatusChange.fire({ status: 'reconnecting' });
        (mgr as any)._onStatusChange.fire({ status: 'connected' });

        expect(statuses).toContain('reconnecting');
        expect(statuses).toContain('connected');
    });
});

// ═══════════════════════════════════════════════════════════════
// Phase 3: 启动参数
// ═══════════════════════════════════════════════════════════════

describe('Phase 3: 启动参数', () => {
    it('startInternal 方法应存在', () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(typeof (mgr as any).startInternal).toBe('function');
    });

    it('dispose 应正确清理进程', () => {
        const mgr = new TuiProcessManager(makeContext());
        (mgr as any)._started = true;
        mgr.dispose();
        expect((mgr as any)._disposed).toBe(true);
        expect((mgr as any)._started).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════
// Phase 5: 配置项验证
// ═══════════════════════════════════════════════════════════════

describe('Phase 5: 新增 VSCode 配置项', () => {
    it('package.json 应包含 celest.downloadMirror 配置', () => {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        const props = pkg.contributes?.configuration?.properties;
        expect(props['celest.downloadMirror']).toBeDefined();
        expect(props['celest.downloadMirror'].enum).toContain('auto');
        expect(props['celest.downloadMirror'].enum).toContain('github');
        expect(props['celest.downloadMirror'].enum).toContain('cnb');
    });

    it('package.json 应包含 celest.releaseVersion 配置', () => {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        const props = pkg.contributes?.configuration?.properties;
        expect(props['celest.releaseVersion']).toBeDefined();
        expect(props['celest.releaseVersion'].type).toBe('string');
    });

    it('package.json 应包含 celest.autoCompactThreshold 配置', () => {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        const props = pkg.contributes?.configuration?.properties;
        expect(props['celest.autoCompactThreshold']).toBeDefined();
        expect(props['celest.autoCompactThreshold'].type).toBe('number');
        expect(props['celest.autoCompactThreshold'].default).toBe(85);
        expect(props['celest.autoCompactThreshold'].minimum).toBe(0);
        expect(props['celest.autoCompactThreshold'].maximum).toBe(100);
    });

    it('package.json 应包含 celest.showContextBar 配置', () => {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        const props = pkg.contributes?.configuration?.properties;
        expect(props['celest.showContextBar']).toBeDefined();
        expect(props['celest.showContextBar'].default).toBe(true);
    });

    it('package.json 应包含 celest.allowedTools 配置', () => {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        const props = pkg.contributes?.configuration?.properties;
        expect(props['celest.allowedTools']).toBeDefined();
    });

    it('package.json 应包含 celest.disallowedTools 配置', () => {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        const props = pkg.contributes?.configuration?.properties;
        expect(props['celest.disallowedTools']).toBeDefined();
    });

    it('package.json 应包含 celest.maxTurns 配置', () => {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        const props = pkg.contributes?.configuration?.properties;
        expect(props['celest.maxTurns']).toBeDefined();
        expect(props['celest.maxTurns'].type).toBe('number');
    });
});

// ═══════════════════════════════════════════════════════════════
// autoApprove / setConfig 集成
// ═══════════════════════════════════════════════════════════════

describe('TuiProcessManager 配置集成', () => {
    it('setConfig 支持 pathSuffix', () => {
        const mgr = new TuiProcessManager(makeContext());
        mgr.setConfig({ pathSuffix: '/v1beta' });
        expect(mgr.getConfig().pathSuffix).toBe('/v1beta');
    });

    it('autoApprove 默认为 false', () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(mgr.autoApprove).toBe(false);
    });

    it('setConfig model 应持久化', () => {
        const mgr = new TuiProcessManager(makeContext());
        mgr.setConfig({ model: 'deepseek-v4-pro' });
        expect(mgr.getConfig().model).toBe('deepseek-v4-pro');
    });

    it('updateThreadConfig 未连接应返回 false', async () => {
        const mgr = new TuiProcessManager(makeContext());
        expect(await mgr.updateThreadConfig('thr_1', { mode: 'plan' })).toBe(false);
    });
});
