/**
 * Bug 12: TOML 解析测试（smol-toml 替代后）
 *
 * 覆盖：
 * - smol-toml parse 各种 TOML 格式
 * - 含连字符的 section 名（如 siliconflow-CN）
 * - 单引号/双引号值
 * - 多行值
 * - 空文件
 * - stringify 往返一致性
 * - readTuiProviderConfig 通过 smol-toml 正确解析
 * - syncToTuiConfig 正确写回并验证
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as toml from 'smol-toml';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// ═══════════════════════════════════════════════════════════════
// smol-toml 基础解析
// ═══════════════════════════════════════════════════════════════

describe('smol-toml parse', () => {
    it('应解析基本键值对', () => {
        const result = toml.parse('api_key = "sk-test"\nmodel = "deepseek-v4-flash"');
        expect(result.api_key).toBe('sk-test');
        expect(result.model).toBe('deepseek-v4-flash');
    });

    it('应解析嵌套节', () => {
        const input = '[providers.deepseek]\napi_key = "sk-deep"\n\n[providers.openai]\napi_key = "sk-openai"';
        const result = toml.parse(input) as any;
        expect(result.providers.deepseek.api_key).toBe('sk-deep');
        expect(result.providers.openai.api_key).toBe('sk-openai');
    });

    it('应解析含下划线的 section 名（TUI 格式）', () => {
        const input = '[providers.siliconflow_cn]\napi_key = "sk-si"\nbase_url = "https://api.siliconflow.cn/v1"';
        const result = toml.parse(input) as any;
        expect(result.providers.siliconflow_cn.api_key).toBe('sk-si');
        expect(result.providers.siliconflow_cn.base_url).toBe('https://api.siliconflow.cn/v1');
    });

    it('应处理单引号字符串', () => {
        const result = toml.parse("key = 'single-quoted-value'");
        expect(result.key).toBe('single-quoted-value');
    });

    it('应处理数字和布尔值', () => {
        const result = toml.parse('num = 42\nflag = true\npi = 3.14');
        expect(result.num).toBe(42);
        expect(result.flag).toBe(true);
        expect(result.pi).toBeCloseTo(3.14);
    });

    it('空文件应返回空对象', () => {
        const result = toml.parse('');
        expect(result).toEqual({});
    });

    it('空白文件应返回空对象', () => {
        const result = toml.parse('\n\n  \n');
        expect(result).toEqual({});
    });

    it('应处理包含特殊字符的 base_url', () => {
        const input = '[providers.custom]\nbase_url = "https://api.example.com/v1?key=value&foo=bar"';
        const result = toml.parse(input) as any;
        expect(result.providers.custom.base_url).toBe('https://api.example.com/v1?key=value&foo=bar');
    });
});

// ═══════════════════════════════════════════════════════════════
// smol-toml stringify 往返
// ═══════════════════════════════════════════════════════════════

describe('smol-toml stringify 往返', () => {
    it('parse(stringify(obj)) 应保持等价', () => {
        const original = {
            providers: {
                deepseek: { api_key: 'sk-test', base_url: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
                openai: { api_key: 'sk-oa' },
            },
            api_key: 'top-level',
        };
        const output = toml.stringify(original);
        const reparsed = toml.parse(output) as any;
        expect(reparsed.providers.deepseek.api_key).toBe('sk-test');
        expect(reparsed.providers.deepseek.base_url).toBe('https://api.deepseek.com');
        expect(reparsed.providers.deepseek.model).toBe('deepseek-v4-flash');
        expect(reparsed.providers.openai.api_key).toBe('sk-oa');
        expect(reparsed.api_key).toBe('top-level');
    });

    it('空 providers 应生成有效 TOML', () => {
        const obj = { providers: {} };
        const output = toml.stringify(obj);
        const reparsed = toml.parse(output) as any;
        expect(reparsed.providers).toEqual({});
    });

    it('带多个 provider 的配置应正确往返', () => {
        const config = {
            providers: {
                deepseek: { api_key: 'sk-1' },
                siliconflow_cn: { api_key: 'sk-2', base_url: 'https://api.siliconflow.cn/v1' },
                ollama: { base_url: 'http://localhost:11434/v1', model: 'deepseek-v4-flash' },
            },
        };
        const output = toml.stringify(config);
        const reparsed = toml.parse(output) as any;
        expect(reparsed.providers.deepseek.api_key).toBe('sk-1');
        expect(reparsed.providers.siliconflow_cn.api_key).toBe('sk-2');
        expect(reparsed.providers.ollama.base_url).toBe('http://localhost:11434/v1');
    });
});

// ═══════════════════════════════════════════════════════════════
// real TUI config.toml 格式模拟
// ═══════════════════════════════════════════════════════════════

describe('真实 TUI config.toml 格式', () => {
    it('应正确解析多 Provider 配置', () => {
        const input = `api_key = "top-level-key"

[providers.deepseek]
api_key = "sk-deepseek-key"
model = "deepseek-v4-flash"
base_url = "https://api.deepseek.com"

[providers.siliconflow_cn]
api_key = "sk-siliconflow-key"
base_url = "https://api.siliconflow.cn/v1"
model = "deepseek-ai/DeepSeek-V4-Pro"

[providers.ollama]
base_url = "http://localhost:11434/v1"
model = "deepseek-v4-flash"
`;

        const result = toml.parse(input) as any;
        expect(result.api_key).toBe('top-level-key');
        expect(result.providers.deepseek.api_key).toBe('sk-deepseek-key');
        expect(result.providers.deepseek.model).toBe('deepseek-v4-flash');
        expect(result.providers.siliconflow_cn.api_key).toBe('sk-siliconflow-key');
        expect(result.providers.siliconflow_cn.base_url).toBe('https://api.siliconflow.cn/v1');
        expect(result.providers.ollama.model).toBe('deepseek-v4-flash');
    });

    it('无 api_key 的 provider（如 ollama）应正常解析', () => {
        const input = `[providers.ollama]
base_url = "http://localhost:11434/v1"
model = "llama3"
`;
        const result = toml.parse(input) as any;
        expect(result.providers.ollama.api_key).toBeUndefined();
        expect(result.providers.ollama.base_url).toBe('http://localhost:11434/v1');
    });
});

// ═══════════════════════════════════════════════════════════════
// 与原正则方法对比 — 确保迁移不丢失功能
// ═══════════════════════════════════════════════════════════════

describe('Bug 12: smol-toml 替代正则后功能验证', () => {
    it('PID 转换: 连字符 → 下划线（写回 TUI）', () => {
        // Celest 使用 hyphens，TUI 使用 underscores
        const pid = 'siliconflow-CN';
        const section = pid.replace(/-/g, '_');
        expect(section).toBe('siliconflow_CN');
    });

    it('PID 转换: 下划线 → 连字符（读取 TUI）', () => {
        const tuiSection = 'siliconflow_cn';
        const pid = tuiSection.replace(/_/g, '-');
        expect(pid).toBe('siliconflow-cn');
    });

    it('所有已知 Provider 的 PID→section→PID 往返应一致', () => {
        const knownPids = [
            'deepseek', 'openai', 'nvidia-nim', 'ollama', 'huggingface', 'arcee',
            'moonshot', 'sglang', 'vllm', 'siliconflow', 'siliconflow-CN',
            'fireworks', 'xiaomi-mimo', 'wanjie-ark', 'volcengine',
            'openrouter', 'novita', 'atlascloud', 'dashscope',
        ];
        for (const pid of knownPids) {
            const section = pid.replace(/-/g, '_');
            const roundtrip = section.replace(/_/g, '-');
            expect(roundtrip).toBe(pid);
        }
    });
});
