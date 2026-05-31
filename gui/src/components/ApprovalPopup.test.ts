/**
 * @vitest-environment jsdom
 *
 * ApprovalPopup 组件测试
 *
 * 覆盖修复项：
 *   - 问题1: 超时拒绝使用 DENY_INDEX (findIndex) 而非硬编码索引 2
 *   - 问题3: 两步确认死代码已清理 (confirmed/pendingLabel/确认区模板)
 *
 * 环境: jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ApprovalPopup from './ApprovalPopup.vue';

// ── VS Code 主题变量 mock ──────────────────────────────────────

function injectVSCodeCSS() {
    const style = document.createElement('style');
    style.setAttribute('id', 'vscode-theme-mock');
    style.textContent = `
        :root {
            --vscode-editor-background: #1e1e1e;
            --vscode-foreground: #cccccc;
            --vscode-panel-border: #3c3c3c;
            --vscode-textBlockQuote-background: #2d2d2d;
            --vscode-textLink-foreground: #3794ff;
            --vscode-descriptionForeground: #999;
            --vscode-list-activeSelectionBackground: #094771;
            --vscode-list-activeSelectionForeground: #fff;
            --vscode-badge-background: #4d4d4d;
            --vscode-badge-foreground: #fff;
        }
    `;
    document.head.appendChild(style);
}

function removeVSCodeCSS() {
    const el = document.getElementById('vscode-theme-mock');
    if (el) el.remove();
}

// ── 默认 props ─────────────────────────────────────────────────

function defaultProps(overrides: Record<string, unknown> = {}) {
    return {
        visible: true,
        approvalId: 'test-approval-001',
        toolName: 'write_file',
        description: '写入文件 /tmp/test.txt',
        toolType: '文件写入',
        impact: '中 — 修改文件内容',
        params: 'path=/tmp/test.txt\ncontent=hello',
        ...overrides,
    };
}

// ═══════════════════════════════════════════════════════════════
// 问题1: DENY_INDEX 替代硬编码索引
// ═══════════════════════════════════════════════════════════════

describe('问题1: 超时拒绝使用 DENY_INDEX', () => {
    beforeEach(() => injectVSCodeCSS());
    afterEach(() => removeVSCodeCSS());

    it('DENY_INDEX 应指向 options 中的拒绝项', () => {
        const wrapper = mount(ApprovalPopup, { props: defaultProps() });
        const vm = wrapper.vm as any;

        expect(vm.DENY_INDEX).toBe(2);
    });

    it('超时通过 DENY_INDEX 自动拒绝应发送 deny', async () => {
        const wrapper = mount(ApprovalPopup, { props: defaultProps() });
        const vm = wrapper.vm as any;

        // 直接调用 commitOption(DENY_INDEX) 模拟超时行为
        vm.commitOption(vm.DENY_INDEX);
        await wrapper.vm.$nextTick();

        expect(wrapper.emitted('decide')).toBeTruthy();
        const [decision, remember] = wrapper.emitted('decide')![0];
        expect(decision).toBe('deny');
        expect(remember).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════
// 问题3: 两步确认死代码已清理
// ═══════════════════════════════════════════════════════════════

describe('问题3: 两步确认死代码已清理', () => {
    beforeEach(() => injectVSCodeCSS());
    afterEach(() => removeVSCodeCSS());

    it('不存在 confirmed 状态', () => {
        const wrapper = mount(ApprovalPopup, {
            props: { visible: false, approvalId: '', toolName: '', description: '' },
        });
        const vm = wrapper.vm as any;

        expect(vm.confirmed).toBeUndefined();
    });

    it('不存在 pendingLabel 状态', () => {
        const wrapper = mount(ApprovalPopup, {
            props: { visible: false, approvalId: '', toolName: '', description: '' },
        });
        const vm = wrapper.vm as any;

        expect(vm.pendingLabel).toBeUndefined();
    });

    it('确认区模板已移除 (.approval-confirm)', () => {
        const wrapper = mount(ApprovalPopup, { props: defaultProps() });

        expect(wrapper.find('.approval-confirm').exists()).toBe(false);
    });

    it('确认区 banner 样式已移除 (.confirm-banner)', () => {
        const wrapper = mount(ApprovalPopup, { props: defaultProps() });

        expect(wrapper.find('.confirm-banner').exists()).toBe(false);
    });

    it('确认区 hint 样式已移除 (.confirm-hint)', () => {
        const wrapper = mount(ApprovalPopup, { props: defaultProps() });

        expect(wrapper.find('.confirm-hint').exists()).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════
// 功能正确性: 单击直接决策
// ═══════════════════════════════════════════════════════════════

describe('单击直接决策', () => {
    beforeEach(() => injectVSCodeCSS());
    afterEach(() => removeVSCodeCSS());

    it('点击"允许本次"应发送 allow (remember=false)', async () => {
        const wrapper = mount(ApprovalPopup, { props: defaultProps() });

        await wrapper.find('.approval-option:first-child').trigger('click');

        const [decision, remember] = wrapper.emitted('decide')![0];
        expect(decision).toBe('allow');
        expect(remember).toBe(false);
    });

    it('点击"信任会话"应发送 allow (remember=true)', async () => {
        const wrapper = mount(ApprovalPopup, { props: defaultProps() });

        const options = wrapper.findAll('.approval-option');
        await options[1].trigger('click');

        const [decision, remember] = wrapper.emitted('decide')![0];
        expect(decision).toBe('allow');
        expect(remember).toBe(true);
    });

    it('点击"拒绝"应发送 deny', async () => {
        const wrapper = mount(ApprovalPopup, { props: defaultProps() });

        const options = wrapper.findAll('.approval-option');
        await options[2].trigger('click');

        const [decision] = wrapper.emitted('decide')![0];
        expect(decision).toBe('deny');
    });

    it('决策后应显示"已发送"状态', async () => {
        const wrapper = mount(ApprovalPopup, { props: defaultProps() });

        await wrapper.find('.approval-option:first-child').trigger('click');

        expect(wrapper.find('.approval-decided').exists()).toBe(true);
        expect(wrapper.find('.approval-decided').text()).toContain('已发送');
    });

    it('决策后选项列表应隐藏', async () => {
        const wrapper = mount(ApprovalPopup, { props: defaultProps() });

        await wrapper.find('.approval-option:first-child').trigger('click');

        expect(wrapper.find('.approval-options').exists()).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════
// 键盘交互
// ═══════════════════════════════════════════════════════════════

describe('键盘交互', () => {
    beforeEach(() => injectVSCodeCSS());
    afterEach(() => removeVSCodeCSS());

    async function triggerKey(wrapper: ReturnType<typeof mount>, key: string) {
        await wrapper.find('.approval-overlay').trigger('keydown', { key });
    }

    it('Enter 应执行当前高亮选项', async () => {
        const wrapper = mount(ApprovalPopup, { props: defaultProps() });

        await triggerKey(wrapper, 'Enter');

        expect(wrapper.emitted('decide')).toBeTruthy();
        // 默认高亮第一个选项（允许本次）
        const [decision] = wrapper.emitted('decide')![0];
        expect(decision).toBe('allow');
    });

    it('数字键 1 应选择第一个选项', async () => {
        const wrapper = mount(ApprovalPopup, { props: defaultProps() });

        await triggerKey(wrapper, '1');

        const [decision] = wrapper.emitted('decide')![0];
        expect(decision).toBe('allow');
    });

    it('数字键 3 应拒绝', async () => {
        const wrapper = mount(ApprovalPopup, { props: defaultProps() });

        await triggerKey(wrapper, '3');

        const [decision] = wrapper.emitted('decide')![0];
        expect(decision).toBe('deny');
    });

    it('ArrowDown 应移动焦点', async () => {
        const wrapper = mount(ApprovalPopup, { props: defaultProps() });

        await triggerKey(wrapper, 'ArrowDown');

        // 焦点应从 0 移到 1
        const vm = wrapper.vm as any;
        expect(vm.focusedIdx).toBe(1);
    });

    it('Esc 不应关闭弹窗', async () => {
        const wrapper = mount(ApprovalPopup, { props: defaultProps() });

        await triggerKey(wrapper, 'Escape');

        // 弹窗应仍然可见，不应发射 decide
        expect(wrapper.emitted('decide')).toBeFalsy();
        expect(wrapper.find('.approval-overlay').exists()).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════
// 生命周期 & 状态重置
// ═══════════════════════════════════════════════════════════════

describe('生命周期 & 状态重置', () => {
    beforeEach(() => injectVSCodeCSS());
    afterEach(() => removeVSCodeCSS());

    it('visible=false 时不渲染弹窗', () => {
        const wrapper = mount(ApprovalPopup, {
            props: { visible: false, approvalId: '', toolName: '', description: '' },
        });

        expect(wrapper.find('.approval-overlay').exists()).toBe(false);
    });

    it('弹窗关闭再打开后状态应完全重置', async () => {
        const wrapper = mount(ApprovalPopup, {
            props: { visible: false, approvalId: '', toolName: '', description: '' },
        });

        // 第一次打开 → 做决策
        await wrapper.setProps(defaultProps({ approvalId: 'first' }));
        await wrapper.find('.approval-option:first-child').trigger('click');
        expect(wrapper.emitted('decide')).toHaveLength(1);

        // 关闭
        await wrapper.setProps({ visible: false });

        // 第二次打开 → 应重置
        await wrapper.setProps(defaultProps({ approvalId: 'second' }));
        expect(wrapper.find('.approval-decided').exists()).toBe(false);
        expect(wrapper.find('.approval-options').exists()).toBe(true);

        // 应能再次决策
        await wrapper.find('.approval-option:last-child').trigger('click');
        expect(wrapper.emitted('decide')).toHaveLength(2);
    });

    it('倒计时显示格式正确', async () => {
        const wrapper = mount(ApprovalPopup, { props: defaultProps() });
        const vm = wrapper.vm as any;

        // 初始 300 秒 = 5:00
        vm.countdown = 300;
        expect(wrapper.find('.approval-timeout').text()).toContain('5:00');

        // 修改 countdown 后需要等 nextTick 触发重渲染
        vm.countdown = 61;
        await wrapper.vm.$nextTick();
        expect(wrapper.find('.approval-timeout').text()).toContain('1:01');
    });
});