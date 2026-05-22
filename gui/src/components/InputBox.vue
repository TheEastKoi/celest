<template>
    <div class="input-box" ref="inputBoxRef">
        <!-- @ 提及弹窗 -->
        <AtMentionPopup
            ref="atPopupRef"
            :visible="showAtPopup"
            :filterText="atFilterText"
            :items="files"
            @select="handleAtSelect"
            @close="closeAtPopup"
        />

        <!-- / 命令弹窗 -->
        <SlashCommandPopup
            ref="slashPopupRef"
            :visible="showSlashPopup"
            :filterText="slashFilterText"
            @select="handleSlashSelect"
            @close="closeSlashPopup"
        />

        <textarea
            ref="inputRef"
            v-model="inputText"
            class="prompt-input"
            placeholder="Ask anything... (@ to reference files, / for commands)"
            rows="3"
            :disabled="disabled"
            @keydown="handleKeydown"
            @input="handleInput"
            @paste="handlePaste"
        ></textarea>

        <div class="input-actions">
            <span class="input-hint">Enter to send, Shift+Enter for newline</span>
            <div class="input-buttons">
                <button
                    v-if="showStop"
                    class="stop-btn"
                    @click="handleStop"
                    title="Stop generation"
                >
                    ⏹ Stop
                </button>
                <button class="send-btn" @click="handleSend" :disabled="!inputText.trim() || disabled">
                    Send
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import AtMentionPopup from './AtMentionPopup.vue';
import SlashCommandPopup from './SlashCommandPopup.vue';
import type { FileItem } from './AtMentionPopup.vue';
import type { SlashCommand } from './SlashCommandPopup.vue';

const props = defineProps<{
    disabled?: boolean;
    showStop?: boolean;
    files: FileItem[];
}>();

const emit = defineEmits<{
    send: [prompt: string];
    stop: [];
}>();

const inputText = ref('');
const inputRef = ref<HTMLTextAreaElement>();
const inputBoxRef = ref<HTMLElement>();
const atPopupRef = ref<InstanceType<typeof AtMentionPopup>>();
const slashPopupRef = ref<InstanceType<typeof SlashCommandPopup>>();

// ── @ / 弹窗状态 ────────────────────────────────────────────────

const showAtPopup = ref(false);
const atFilterText = ref('');
const showSlashPopup = ref(false);
const slashFilterText = ref('');

// 记录触发位置（替换时用）
let atTriggerPos = -1;
let slashTriggerPos = -1;

// 弹窗是否「激活」中（防止和 Enter 发送冲突）
function isPopupActive(): boolean {
    return showAtPopup.value || showSlashPopup.value;
}

function closeAtPopup() { showAtPopup.value = false; atFilterText.value = ''; atTriggerPos = -1; }
function closeSlashPopup() { showSlashPopup.value = false; slashFilterText.value = ''; slashTriggerPos = -1; }
function closeAllPopups() { closeAtPopup(); closeSlashPopup(); }

// ── @ 选择 → 替换文本 ──────────────────────────────────────────

function handleAtSelect(item: FileItem) {
    if (atTriggerPos >= 0 && atTriggerPos <= inputText.value.length) {
        const before = inputText.value.slice(0, atTriggerPos);
        const after = inputText.value.slice(inputRef.value?.selectionStart || atTriggerPos + atFilterText.value.length + 1);
        inputText.value = before + '@' + item.relativePath + ' ' + after;
    }
    closeAtPopup();
    inputRef.value?.focus();
}

// ── / 选择 → 替换文本 ──────────────────────────────────────────

function handleSlashSelect(cmd: SlashCommand) {
    if (slashTriggerPos >= 0 && slashTriggerPos <= inputText.value.length) {
        const cursor = inputRef.value?.selectionStart ?? inputText.value.length;
        const slashIdx = inputText.value.lastIndexOf('/', cursor);
        if (slashIdx >= 0) {
            const before = inputText.value.slice(0, slashIdx);
            const after = inputText.value.slice(cursor);
            inputText.value = before + '/' + cmd.name + ' ' + after;
            nextTick(() => {
                if (inputRef.value) {
                    inputRef.value.selectionStart = inputRef.value.selectionEnd = slashIdx + cmd.name.length + 2;
                }
            });
        }
    }
    closeSlashPopup();
    inputRef.value?.focus();
}

// ── 键盘事件 ───────────────────────────────────────────────────

function handleKeydown(e: KeyboardEvent) {
    if (showAtPopup.value) {
        if (e.key === 'ArrowDown') { e.preventDefault(); atPopupRef.value?.moveSelection(1); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); atPopupRef.value?.moveSelection(-1); return; }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const sel = atPopupRef.value?.getSelected();
            if (sel) handleAtSelect(sel);
            return;
        }
        if (e.key === 'Escape') { e.preventDefault(); closeAtPopup(); return; }
    }

    if (showSlashPopup.value) {
        if (e.key === 'ArrowDown') { e.preventDefault(); slashPopupRef.value?.moveSelection(1); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); slashPopupRef.value?.moveSelection(-1); return; }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const sel = slashPopupRef.value?.getSelected();
            if (sel) handleSlashSelect(sel);
            return;
        }
        if (e.key === 'Escape') { e.preventDefault(); closeSlashPopup(); return; }
    }

    // Enter 发送 / Shift+Enter 换行
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
        return;
    }
    if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        handleNewline();
    }
}

// ── 输入检测 @ / ───────────────────────────────────────────────

function handleInput() {
    autoResize();

    const el = inputRef.value;
    if (!el) return;
    const cursor = el.selectionStart;
    const before = inputText.value.slice(0, cursor);

    // 检测 @ 提及
    const atMatch = before.match(/@(\S*)$/);
    if (atMatch && !showSlashPopup.value) {
        atTriggerPos = cursor - atMatch[0].length;
        atFilterText.value = atMatch[1];
        showAtPopup.value = true;
        return;
    }
    // 检测 / 命令（仅在行首或空格后）
    const slashMatch = before.match(/(?:^|\s)\/(\S*)$/);
    if (slashMatch && !showAtPopup.value && !before.includes('@')) {
        slashTriggerPos = cursor - slashMatch[0].length + 1; // +1 skip the leading space
        slashFilterText.value = slashMatch[1];
        showSlashPopup.value = true;
        return;
    }

    // 不匹配则关闭弹窗
    closeAllPopups();
}

/** 粘贴处理：从剪贴板提取文件路径自动加 @ */
function handlePaste(e: ClipboardEvent) {
    const cd = e.clipboardData;
    if (!cd) return;

    const plain = cd.getData('text/plain')?.trim();

    // 1. 有文本内容 — 直接用，如果是路径则自动加 @
    if (plain) {
        if (plain.includes('\n')) {
            const lines = plain.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length > 1 && lines.every(isFilePath)) {
                e.preventDefault();
                insertAtCursor(lines.map(l => '@' + l).join('\n'));
                return;
            }
        }
        if (isFilePath(plain)) {
            e.preventDefault();
            insertAtCursor('@' + plain + ' ');
            return;
        }
        return; // 普通文本，浏览器正常粘贴
    }

    // 2. 无文本，从 HTML 中提取 file:// 路径
    const html = cd.getData('text/html');
    if (html) {
        const match = html.match(/file:\/\/\/([^"<>\s]+)/i);
        if (match) {
            e.preventDefault();
            insertAtCursor('@' + decodeURIComponent(match[1]).replace(/\//g, '\\') + ' ');
            return;
        }
    }

    // 3. 仅有图片 blob → 发给后端保存为临时文件
    const hasImage = cd.files.length > 0 || cd.types.some(t => t.startsWith('image/'));
    if (hasImage) {
        e.preventDefault();
        const file = cd.files[0];
        if (file) {
            savePastedImage(file);
        } else {
            for (const item of cd.items) {
                if (item.type.startsWith('image/')) {
                    const blob = item.getAsFile();
                    if (blob) { savePastedImage(blob); break; }
                }
            }
        }
    }
}

async function savePastedImage(file: File) {
    const placeholder = '@[' + file.name + '] ';
    insertAtCursor(placeholder);
    const reader = new FileReader();
    reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        vscode?.postMessage({
            type: 'pasteImage',
            fileName: file.name || `paste_${Date.now()}.png`,
            data: base64,
        });
    };
    reader.readAsDataURL(file);
}

/** 替换输入框中的文本 */
function replaceText(oldText: string, newText: string) {
    inputText.value = inputText.value.replace(oldText, newText);
}

defineExpose({ insertAtCursor, replaceText });

function isFilePath(s: string): boolean {
    if (!s || s.length < 3) return false;
    return /^[A-Za-z]:[\\/]/.test(s) ||
        (s.includes('\\') && s.length > 3) ||
        (s.startsWith('/') && s.length > 2);
}

function autoResize() {
    const el = inputRef.value;
    if (el) {
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
}

// ── 发送 / 停止 ────────────────────────────────────────────────

function handleSend() {
    if (isPopupActive()) return; // 弹窗激活时不发送
    const text = inputText.value.trim();
    if (!text || props.disabled) return;
    emit('send', text);
    inputText.value = '';
    nextTick(() => autoResize());
}

function handleStop() {
    emit('stop');
}

function handleNewline() {
    const el = inputRef.value;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    inputText.value = inputText.value.slice(0, start) + '\n' + inputText.value.slice(end);
    nextTick(() => {
        el.selectionStart = el.selectionEnd = start + 1;
    });
}

/** 在光标处插入文本（用于右键 @ 提及等外部触发） */
function insertAtCursor(text: string) {
    const el = inputRef.value;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    inputText.value = inputText.value.slice(0, start) + text + inputText.value.slice(end);
    nextTick(() => {
        const pos = start + text.length;
        el.selectionStart = el.selectionEnd = pos;
        el.focus();
    });
}

</script>

<style scoped>
.input-box {
    position: relative;
    padding: 10px 12px 8px;
}
.prompt-input {
    width: 100%;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 8px;
    padding: 10px 12px;
    font-family: var(--vscode-font-family);
    font-size: 13px;
    line-height: 1.5;
    resize: none;
    outline: none;
    box-sizing: border-box;
    min-height: 80px;
    max-height: 200px;
}
.prompt-input:focus {
    border-color: var(--vscode-focusBorder);
}
.prompt-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
.input-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 6px;
}
.input-hint {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    user-select: none;
}
.input-buttons {
    display: flex;
    gap: 6px;
    align-items: center;
}
.stop-btn {
    background: #f85149;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 5px 12px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.4;
    white-space: nowrap;
}
.stop-btn:hover { background: #ff6b5e; }
.send-btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 6px;
    padding: 6px 18px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
}
.send-btn:hover { background: var(--vscode-button-hoverBackground); }
.send-btn:disabled { opacity: 0.5; cursor: default; }
</style>
