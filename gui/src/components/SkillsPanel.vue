<template>
  <div class="skills-panel">
    <div v-if="warnings.length" class="warnings">
      <div v-for="(w, i) in warnings" :key="i" class="warning-item">⚠ {{ w }}</div>
    </div>

    <div v-if="loading" class="loading">Loading skills…</div>

    <div v-else-if="skills.length === 0" class="empty">
      <p>No skills discovered.</p>
      <p class="hint">Place SKILL.md files in <code>.agents/skills/</code> or <code>skills/</code> under your workspace.</p>
    </div>

    <div v-else class="skill-list">
      <div
        v-for="skill in skills"
        :key="skill.name"
        class="skill-item"
        :class="{ disabled: !skill.enabled }"
      >
        <div class="skill-info">
          <span class="skill-name">{{ skill.name }}</span>
          <span class="skill-desc">{{ skill.description }}</span>
        </div>
        <label class="toggle-switch" :title="skill.enabled ? 'Disable skill' : 'Enable skill'">
          <input
            type="checkbox"
            :checked="skill.enabled"
            @change="emit('toggle', skill.name, !skill.enabled)"
          />
          <span class="slider"></span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface SkillEntry {
  name: string;
  description: string;
  path: string;
  enabled: boolean;
}

defineProps<{
  skills: SkillEntry[];
  warnings: string[];
  loading: boolean;
}>();

const emit = defineEmits<{
  toggle: [name: string, enabled: boolean];
}>();
</script>

<style scoped>
.skills-panel {
  padding: 4px 0;
  height: 100%;
  overflow-y: auto;
  font-family: var(--vscode-font-family);
  color: var(--vscode-foreground);
}

.warnings {
  margin-bottom: 8px;
}

.warning-item {
  font-size: 12px;
  color: var(--vscode-editorWarning-foreground, #cca700);
  padding: 3px 0;
}

.loading, .empty {
  text-align: center;
  padding: 16px;
  color: var(--vscode-descriptionForeground);
  font-size: 13px;
}

.hint {
  font-size: 12px;
  margin-top: 6px;
}

.hint code {
  background: var(--vscode-textCodeBlock-background);
  padding: 1px 4px;
  border-radius: 3px;
}

.skill-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.skill-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 5px;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border, #333);
  transition: opacity 0.2s;
}

.skill-item.disabled {
  opacity: 0.55;
}

.skill-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.skill-name {
  font-size: 12px;
  font-weight: 500;
}

.skill-desc {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
  flex-shrink: 0;
  cursor: pointer;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  inset: 0;
  background: var(--vscode-input-background, #555);
  border-radius: 9px;
  transition: 0.2s;
}

.slider::before {
  content: '';
  position: absolute;
  height: 14px;
  width: 14px;
  left: 2px;
  bottom: 2px;
  background: var(--vscode-foreground);
  border-radius: 50%;
  transition: 0.2s;
}

input:checked + .slider {
  background: var(--vscode-button-background, #0e639c);
}

input:checked + .slider::before {
  transform: translateX(14px);
}
</style>
