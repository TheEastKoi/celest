<template>
    <div class="settings-panel" v-if="visible">
        <div class="settings-overlay" @click="$emit('close')"></div>
        <div class="settings-dialog">
            <div class="settings-header">
                <h3>{{ t('settings.title') }}</h3>
                <button class="close-btn" @click="$emit('close')">✕</button>
            </div>
            
            <div class="settings-tabs">
                <button 
                    v-for="tab in tabs" :key="tab.id"
                    :class="['tab-btn', { active: activeTab === tab.id }]"
                    @click="activeTab = tab.id"
                >{{ tab.label }}</button>
            </div>

            <div class="settings-body">
                <!-- 通用 -->
                <div v-if="activeTab === 'general'" class="tab-content">
                    <div class="setting-group">
                        <label class="setting-label">{{ t('settings.locale') }}</label>
                        <p class="setting-desc">{{ t('settings.localeDesc') }}</p>
                        <select v-model="localConfig.locale" class="setting-select">
                            <option value="zh-CN">简体中文</option>
                            <option value="en">English</option>
                        </select>
                    </div>

                    <div class="setting-group">
                        <label class="setting-label">{{ t('settings.binaryPath') }}</label>
                        <p class="setting-desc">{{ t('settings.binaryPathDesc') }}</p>
                        <div class="path-row">
                            <input v-model="localConfig.binaryPath" class="setting-input" placeholder="auto" />
                            <button class="btn btn-small" @click="browseBinary">{{ '...' }}</button>
                        </div>
                    </div>

                    <div class="setting-group">
                        <label class="setting-label">{{ t('settings.autoDownload') }}</label>
                        <p class="setting-desc">{{ t('settings.autoDownloadDesc') }}</p>
                        <label class="toggle-row">
                            <input type="checkbox" v-model="localConfig.autoDownloadBinary" />
                            <span class="toggle-label">{{ localConfig.autoDownloadBinary ? 'ON' : 'OFF' }}</span>
                        </label>
                    </div>
                </div>

                <!-- 模型 -->
                <div v-if="activeTab === 'model'" class="tab-content">
                    <div class="setting-group">
                        <label class="setting-label">{{ t('settings.provider') }}</label>
                        <p class="setting-desc">{{ t('settings.providerDesc') }}</p>
                        <select v-model="localConfig.provider" class="setting-select">
                            <option v-for="p in providerOptions" :key="p.id" :value="p.id" :disabled="p.disabled">{{ p.label }}</option>
                        </select>
                    </div>

                    <div class="setting-group">
                        <label class="setting-label">{{ t('settings.reasoningEffort') }}</label>
                        <p class="setting-desc">{{ t('settings.reasoningEffortDesc') }}</p>
                        <select v-model="localConfig.reasoningEffort" class="setting-select">
                            <option v-for="r in reasoningEfforts" :key="r.id" :value="r.id">{{ r.name }}</option>
                        </select>
                    </div>

                    <div class="setting-group">
                        <label class="setting-label">{{ t('settings.pathSuffix') }}</label>
                        <p class="setting-desc">{{ t('settings.pathSuffixDesc') }}</p>
                        <input v-model="localConfig.pathSuffix" class="setting-input" :placeholder="t('settings.pathSuffixPlaceholder')" />
                    </div>

                    <!-- ── Provider 凭证配置 ── -->
                    <div class="setting-divider">
                        <span>{{ t('settings.providerCredentials') }}</span>
                    </div>

                    <div class="setting-group">
                        <label class="setting-label">{{ t('settings.configureProvider') }}</label>
                        <p class="setting-desc">{{ t('settings.configureProviderDesc') }}</p>
                        <select v-model="credentialProvider" class="setting-select">
                            <option v-for="p in providerOptions" :key="p.id" :value="p.id" :disabled="p.disabled">{{ p.label }}</option>
                        </select>
                    </div>

                    <div class="setting-group">
                        <label class="setting-label">{{ t('settings.apiKey') }}</label>
                        <p class="setting-desc">
                            {{ t('settings.apiKeyForProvider', { provider: credentialProvider }) }}
                            <span v-if="hasProviderKey(credentialProvider)" class="status-ok">✓ {{ t('settings.apiKeySet') }}</span>
                            <span v-else class="status-warn">{{ t('settings.apiKeyNotSet') }}</span>
                        </p>
                        <div class="api-key-row">
                            <input 
                                v-model="providerKeys[credentialProvider]" 
                                :type="showKey ? 'text' : 'password'" 
                                class="setting-input"
                                :placeholder="t('settings.apiKeyPlaceholder')"
                            />
                            <button class="btn btn-small" @click="showKey = !showKey">{{ showKey ? '🙈' : '👁' }}</button>
                        </div>
                    </div>

                    <div class="setting-group">
                        <label class="setting-label">{{ t('settings.providerBaseUrl') }}</label>
                        <p class="setting-desc">{{ t('settings.providerBaseUrlDesc', { default: getProviderDefault(credentialProvider, 'baseUrl') }) }}</p>
                        <input v-model="providerBaseUrls[credentialProvider]" class="setting-input" :placeholder="getProviderDefault(credentialProvider, 'baseUrl')" />
                    </div>

                    <div class="setting-group">
                        <label class="setting-label">{{ t('settings.providerModel') }}</label>
                        <p class="setting-desc">{{ t('settings.providerModelDesc', { default: getProviderDefault(credentialProvider, 'model') }) }}</p>
                        <select v-model="providerModels[credentialProvider]" class="setting-select">
                            <option v-for="m in getModelsForProvider(credentialProvider)" :key="m.id" :value="m.id">{{ m.name }} — {{ m.description }}</option>
                        </select>
                    </div>
                </div>

                <!-- 关于 -->
                <div v-if="activeTab === 'about'" class="tab-content">
                    <div class="about-section">
                        <div class="about-logo"><img :src="iconPng" class="about-logo-img" /> Celest</div>
                        <div class="about-version">v{{ extVersion }}</div>
                        
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-key">{{ t('settings.version') }}</span>
                                <span class="info-val">{{ extVersion }}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-key">{{ t('settings.tuiVersion') }}</span>
                                <span class="info-val">{{ tuiVersion || t('common.unknown') }}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-key">{{ t('settings.tuiStatus') }}</span>
                                <span :class="['info-val', tuiConnected ? 'status-ok' : 'status-warn']">
                                    {{ tuiConnected ? 'Connected' : 'Disconnected' }}
                                </span>
                            </div>
                            <div class="info-item">
                                <span class="info-key">{{ t('settings.nodeVersion') }}</span>
                                <span class="info-val">{{ nodeVersion }}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-key">{{ t('settings.vscodeVersion') }}</span>
                                <span class="info-val">{{ vscodeVersion }}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-key">OCR (tesseract)</span>
                                <span :class="['info-val', ocrAvailable ? 'status-ok' : 'status-warn']">
                                    {{ ocrAvailable ? '✓ 可用' : '✗ 未安装' }}
                                </span>
                            </div>
                            <div v-if="!ocrAvailable" class="info-hint">
                                图片识别需要安装 Tesseract OCR。
                                <a href="https://github.com/UB-Mannheim/tesseract/wiki" target="_blank">下载 Windows 版</a>，
                                安装时勾选中文语言包（chi_sim）。
                            </div>
                        </div>

                        <div class="about-actions">
                            <button class="btn" @click="$emit('downloadBinary')">{{ t('settings.download') }}</button>
                            <button class="btn" @click="$emit('checkUpdate')">{{ t('settings.checkUpdate') }}</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="settings-footer">
                <button class="btn btn-secondary" @click="$emit('close')">{{ t('common.cancel') }}</button>
                <button class="btn btn-primary" @click="handleSave">{{ t('settings.save') }}</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import iconPng from '../assets/icon.png';
import { t, setLocale, getAvailableModels, getModelsForProvider, getReasoningEfforts, getAllProviders, getProviderDefaults } from '../i18n';

const props = defineProps<{
    visible: boolean;
    config: {
        apiBase: string;
        defaultModel: string;
        autoDownloadBinary: boolean;
        binaryPath: string;
        locale: string;
        provider: string;
        reasoningEffort: string;
        pathSuffix?: string;
        providerApiKeys?: Record<string, boolean>;
        providerBaseUrls?: Record<string, string>;
        providerModels?: Record<string, string>;
    };
    apiKeyStored: boolean;
    tuiVersion: string;
    tuiConnected: boolean;
    ocrAvailable: boolean;
    extVersion: string;
    nodeVersion: string;
    vscodeVersion: string;
}>();

const emit = defineEmits<{
    close: [];
    save: [config: any];
    downloadBinary: [];
    checkUpdate: [];
    browseBinary: [];
}>();

const activeTab = ref('general');
const showKey = ref(false);

// Provider 凭证编辑状态
const credentialProvider = ref(props.config.provider || 'deepseek');
const providerKeys = reactive<Record<string, string>>({});
const providerBaseUrls = reactive<Record<string, string>>({});
const providerModels = reactive<Record<string, string>>({});

// 初始化已保存的 provider base URL / model
onMounted(() => {
    if (props.config.providerBaseUrls) {
        Object.assign(providerBaseUrls, props.config.providerBaseUrls);
    }
    if (props.config.providerModels) {
        Object.assign(providerModels, props.config.providerModels);
    }
});

const providerOptions = computed(() => {
    const providers = getAllProviders();
    return [
        ...providers.filter(p => !p.legacy).map(p => ({
            id: p.id,
            label: p.label,
            disabled: false,
        })),
        { id: '─', label: '──────────────', disabled: true },
        ...providers.filter(p => p.legacy).map(p => ({
            id: p.id,
            label: p.label + ' (legacy)',
            disabled: false,
        })),
    ];
});

function getProviderDefault(providerId: string, field: 'baseUrl' | 'model'): string {
    const defaults = getProviderDefaults();
    const p = defaults[providerId];
    if (!p) return '';
    return field === 'baseUrl' ? p.baseUrl : p.model;
}

function hasProviderKey(providerId: string): boolean {
    if (props.config.providerApiKeys && props.config.providerApiKeys[providerId]) return true;
    return !!providerKeys[providerId];
}

// 默认模型只在 active provider 关联
const activeModels = computed(() => {
    const all = getAvailableModels();
    const provider = localConfig.provider;
    // 根据 provider 过滤推荐模型
    const providerModels: Record<string, string[]> = {
        deepseek: ['deepseek-v4-pro', 'deepseek-v4-flash'],
        openai: ['gpt-4.1', 'gpt-4o'],
        arcee: ['trinity-large-thinking'],
        moonshot: ['kimi-k2.6'],
        'xiaomi-mimo': ['mimo-v2.5-pro', 'mimo-v2.5'],
        dashscope: ['qwen3-235b-a22b', 'qwen3-235b-a22b-thinking', 'qwen3-30b-a3b', 'qwen-plus', 'qwen-max', 'qwen-turbo'],
    };
    const recs = providerModels[provider] || [];
    // 推荐模型前置
    const recSet = new Set(recs);
    const recItems = all.filter(m => recSet.has(m.id));
    const otherItems = all.filter(m => !recSet.has(m.id));
    return [...recItems, ...otherItems];
});

const tabs = computed(() => [
    { id: 'general', label: t('settings.general') },
    { id: 'model', label: t('settings.model') },
    { id: 'about', label: t('settings.about') },
]);

const localConfig = reactive({
    apiBase: props.config.apiBase || 'https://api.deepseek.com',
    defaultModel: props.config.defaultModel || 'deepseek-v4-flash',
    autoDownloadBinary: props.config.autoDownloadBinary ?? true,
    binaryPath: props.config.binaryPath || '',
    locale: props.config.locale || 'zh-CN',
    provider: props.config.provider || 'deepseek',
    reasoningEffort: props.config.reasoningEffort || 'max',
    pathSuffix: (props.config as any).pathSuffix || '',
});

const availableModels = computed(() => getAvailableModels());
const reasoningEfforts = computed(() => getReasoningEfforts());

// provider 切换时自动联动默认模型和 Base URL
const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
    deepseek: 'deepseek-v4-flash',
    openai: 'gpt-4.1',
    'nvidia-nim': 'deepseek-ai/deepseek-v4-pro',
    ollama: 'deepseek-v4-flash',
    huggingface: 'deepseek-ai/DeepSeek-V4-Pro',
    arcee: 'trinity-large-thinking',
    moonshot: 'kimi-k2.6',
    sglang: 'deepseek-ai/DeepSeek-V4-Pro',
    vllm: 'deepseek-ai/DeepSeek-V4-Pro',
    siliconflow: 'deepseek-ai/DeepSeek-V4-Pro',
    'siliconflow-CN': 'deepseek-ai/DeepSeek-V4-Pro',
    fireworks: 'accounts/fireworks/models/deepseek-v4-pro',
    'xiaomi-mimo': 'mimo-v2.5-pro',
    'wanjie-ark': 'deepseek-v4-flash',
    volcengine: 'DeepSeek-V4-Pro',
    openrouter: 'deepseek/deepseek-v4-pro',
    novita: 'deepseek/deepseek-v4-pro',
    atlascloud: 'deepseek-ai/deepseek-v4-flash',
    dashscope: 'qwen3-235b-a22b',
};

watch(() => localConfig.provider, (newProvider) => {
    const model = PROVIDER_DEFAULT_MODELS[newProvider];
    if (model) localConfig.defaultModel = model;
    // 始终同步凭证编辑的 provider（无论是否有 Key）
    credentialProvider.value = newProvider;
});

// credentialProvider 切换时自动填入默认 Base URL / Model（仅当从未配置过，不清空已手动输入的值）
watch(credentialProvider, (newP) => {
    if (providerBaseUrls[newP] === undefined) {
        providerBaseUrls[newP] = getProviderDefault(newP, 'baseUrl');
    }
    if (providerModels[newP] === undefined) {
        providerModels[newP] = getProviderDefault(newP, 'model');
    }
});

watch(() => props.config, (newConfig) => {
    if (newConfig) {
        Object.assign(localConfig, {
            apiBase: newConfig.apiBase || localConfig.apiBase,
            defaultModel: newConfig.defaultModel || localConfig.defaultModel,
            autoDownloadBinary: newConfig.autoDownloadBinary ?? localConfig.autoDownloadBinary,
            binaryPath: newConfig.binaryPath ?? localConfig.binaryPath,
        });
        if (newConfig.providerBaseUrls) {
            Object.assign(providerBaseUrls, newConfig.providerBaseUrls);
        }
        if (newConfig.providerModels) {
            Object.assign(providerModels, newConfig.providerModels);
        }
    }
}, { deep: true });

function handleSave() {
    if (localConfig.locale) {
        setLocale(localConfig.locale as 'zh-CN' | 'en');
    }
    emit('save', {
        ...localConfig,
        providerKeys: { ...providerKeys },
        providerBaseUrls: { ...providerBaseUrls },
        providerModels: { ...providerModels },
    });
}

function browseBinary() {
    emit('browseBinary');
}
</script>

<style scoped>
.settings-panel { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; }
.settings-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); }
.settings-dialog { position: relative; width: 560px; max-height: 85vh; background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
.settings-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border); }
.settings-header h3 { margin: 0; font-size: 16px; }
.close-btn { background: none; border: none; color: var(--vscode-descriptionForeground); cursor: pointer; font-size: 18px; padding: 4px 8px; border-radius: 4px; }
.close-btn:hover { background: var(--vscode-toolbar-hoverBackground); color: var(--vscode-foreground); }

.settings-tabs { display: flex; padding: 0 20px; border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border); }
.tab-btn { padding: 8px 16px; border: none; background: none; color: var(--vscode-descriptionForeground); cursor: pointer; font-size: 13px; border-bottom: 2px solid transparent; transition: all 0.15s; }
.tab-btn:hover { color: var(--vscode-foreground); }
.tab-btn.active { color: var(--vscode-focusBorder); border-bottom-color: var(--vscode-focusBorder); }

.settings-body { flex: 1; overflow-y: auto; padding: 20px; }
.tab-content { display: flex; flex-direction: column; gap: 14px; }

.setting-group { display: flex; flex-direction: column; gap: 4px; }
.setting-label { font-size: 13px; font-weight: 600; color: var(--vscode-foreground); }
.setting-desc { font-size: 11px; color: var(--vscode-descriptionForeground); margin: 0; }
.setting-input { padding: 6px 10px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box; }
.setting-input:focus { outline: none; border-color: var(--vscode-focusBorder); }
.setting-select { padding: 6px 10px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 4px; font-size: 13px; width: 100%; cursor: pointer; }
.setting-divider { display: flex; align-items: center; gap: 12px; margin: 6px 0; }
.setting-divider::before, .setting-divider::after { content: ''; flex: 1; height: 1px; background: var(--vscode-sideBarSectionHeader-border); }
.setting-divider span { font-size: 12px; color: var(--vscode-descriptionForeground); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
.api-key-row { display: flex; gap: 6px; }
.api-key-row .setting-input { flex: 1; }
.path-row { display: flex; gap: 6px; }
.path-row .setting-input { flex: 1; }
.key-status { font-size: 11px; }
.status-ok { color: var(--vscode-testing-iconPassed); }
.status-warn { color: var(--vscode-testing-iconFailed); }

.toggle-row { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; }
.toggle-label { color: var(--vscode-descriptionForeground); font-size: 12px; }

.about-section { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.about-logo { font-size: 28px; font-weight: 700; display: flex; align-items: center; gap: 10px; justify-content: center; }
.about-logo-img { width: 40px; height: 40px; }
.about-version { font-size: 14px; color: var(--vscode-descriptionForeground); }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; }
.info-item { display: flex; justify-content: space-between; padding: 6px 10px; background: var(--vscode-textBlockQuote-background); border-radius: 4px; }
.info-key { font-size: 12px; color: var(--vscode-descriptionForeground); }
.info-val { font-size: 12px; font-weight: 600; }
.info-hint { grid-column: 1 / -1; font-size: 11px; color: var(--vscode-descriptionForeground); padding: 4px 0; }
.about-actions { display: flex; gap: 8px; margin-top: 8px; }

.settings-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--vscode-sideBarSectionHeader-border); }
.btn { padding: 6px 16px; border: 1px solid var(--vscode-button-border); background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-radius: 4px; cursor: pointer; font-size: 13px; }
.btn:hover { background: var(--vscode-button-hoverBackground); }
.btn-small { padding: 4px 8px; font-size: 12px; }
.btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
.btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
.btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
</style>
