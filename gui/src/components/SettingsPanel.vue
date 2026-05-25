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
                        <label class="setting-label">{{ t('settings.apiBase') }}</label>
                        <p class="setting-desc">{{ t('settings.apiBaseDesc') }}</p>
                        <input v-model="localConfig.apiBase" class="setting-input" placeholder="https://api.deepseek.com" />
                    </div>

                    <div class="setting-group">
                        <label class="setting-label">{{ t('settings.apiKey') }}</label>
                        <p class="setting-desc">{{ t('settings.apiKeyDesc') }}</p>
                        <div class="api-key-row">
                            <input 
                                v-model="localConfig.apiKey" 
                                :type="showKey ? 'text' : 'password'" 
                                class="setting-input" 
                                :placeholder="t('settings.apiKeyPlaceholder')"
                            />
                            <button class="btn btn-small" @click="showKey = !showKey">{{ showKey ? '🙈' : '👁' }}</button>
                        </div>
                        <div class="key-status">
                            <span v-if="apiKeyStored" class="status-ok">{{ t('settings.apiKeySet') }} ✓</span>
                            <span v-else class="status-warn">{{ t('settings.apiKeyNotSet') }}</span>
                        </div>
                    </div>

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
                        <label class="setting-label">{{ t('settings.defaultModel') }}</label>
                        <p class="setting-desc">{{ t('settings.defaultModelDesc') }}</p>
                        <select v-model="localConfig.defaultModel" class="setting-select">
                            <option v-for="m in availableModels" :key="m.id" :value="m.id">
                                {{ m.name }} — {{ m.description }}
                            </option>
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
                        <label class="setting-label">{{ t('settings.provider') }}</label>
                        <p class="setting-desc">{{ t('settings.providerDesc') }}</p>
                        <select v-model="localConfig.provider" class="setting-select">
                            <option value="deepseek">DeepSeek</option>
                            <option value="deepseek-cn">DeepSeek CN</option>
                            <option value="openai">OpenAI</option>
                            <option value="nvidia-nim">NVIDIA NIM</option>
                            <option value="ollama">Ollama</option>
                        </select>
                    </div>
                </div>

                <!-- 关于 -->
                <div v-if="activeTab === 'about'" class="tab-content">
                    <div class="about-section">
                        <div class="about-logo">🌙 Celest</div>
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
import { t, setLocale, getAvailableModels, getReasoningEfforts } from '../i18n';

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
    };
    apiKeyStored: boolean;
    tuiVersion: string;
    tuiConnected: boolean;
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
    apiKey: '',
});

const availableModels = getAvailableModels();
const reasoningEfforts = getReasoningEfforts();

watch(() => props.config, (newConfig) => {
    if (newConfig) {
        Object.assign(localConfig, {
            apiBase: newConfig.apiBase || localConfig.apiBase,
            defaultModel: newConfig.defaultModel || localConfig.defaultModel,
            autoDownloadBinary: newConfig.autoDownloadBinary ?? localConfig.autoDownloadBinary,
            binaryPath: newConfig.binaryPath ?? localConfig.binaryPath,
        });
    }
}, { deep: true });

function handleSave() {
    // 即时应用语言
    if (localConfig.locale) {
        setLocale(localConfig.locale as 'zh-CN' | 'en');
    }
    emit('save', { ...localConfig });
}

function browseBinary() {
    emit('browseBinary');
}
</script>

<style scoped>
.settings-panel { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; }
.settings-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); }
.settings-dialog { position: relative; width: 520px; max-height: 80vh; background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
.settings-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border); }
.settings-header h3 { margin: 0; font-size: 16px; }
.close-btn { background: none; border: none; color: var(--vscode-descriptionForeground); cursor: pointer; font-size: 18px; padding: 4px 8px; border-radius: 4px; }
.close-btn:hover { background: var(--vscode-toolbar-hoverBackground); color: var(--vscode-foreground); }

.settings-tabs { display: flex; padding: 0 20px; border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border); }
.tab-btn { padding: 8px 16px; border: none; background: none; color: var(--vscode-descriptionForeground); cursor: pointer; font-size: 13px; border-bottom: 2px solid transparent; transition: all 0.15s; }
.tab-btn:hover { color: var(--vscode-foreground); }
.tab-btn.active { color: var(--vscode-focusBorder); border-bottom-color: var(--vscode-focusBorder); }

.settings-body { flex: 1; overflow-y: auto; padding: 20px; }
.tab-content { display: flex; flex-direction: column; gap: 16px; }

.setting-group { display: flex; flex-direction: column; gap: 4px; }
.setting-label { font-size: 13px; font-weight: 600; color: var(--vscode-foreground); }
.setting-desc { font-size: 11px; color: var(--vscode-descriptionForeground); margin: 0; }
.setting-input { padding: 6px 10px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 4px; font-size: 13px; width: 100%; box-sizing: border-box; }
.setting-input:focus { outline: none; border-color: var(--vscode-focusBorder); }
.setting-select { padding: 6px 10px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 4px; font-size: 13px; width: 100%; cursor: pointer; }
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
.about-logo { font-size: 28px; font-weight: 700; }
.about-version { font-size: 14px; color: var(--vscode-descriptionForeground); }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; }
.info-item { display: flex; justify-content: space-between; padding: 6px 10px; background: var(--vscode-textBlockQuote-background); border-radius: 4px; }
.info-key { font-size: 12px; color: var(--vscode-descriptionForeground); }
.info-val { font-size: 12px; font-weight: 600; }
.about-actions { display: flex; gap: 8px; margin-top: 8px; }

.settings-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--vscode-sideBarSectionHeader-border); }
.btn { padding: 6px 16px; border: 1px solid var(--vscode-button-border); background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-radius: 4px; cursor: pointer; font-size: 13px; }
.btn:hover { background: var(--vscode-button-hoverBackground); }
.btn-small { padding: 4px 8px; font-size: 12px; }
.btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
.btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
.btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
</style>
