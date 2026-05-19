<template>
    <div class="markdown-body" v-html="renderedHtml" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';

// Register common languages to keep bundle small
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);

const md = new MarkdownIt({
    html: false,
    breaks: true,
    linkify: true,
    highlight(str: string, lang: string) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(str, { language: lang }).value;
            } catch {}
        }
        return '';
    },
});

const props = defineProps<{ content: string }>();
const renderedHtml = computed(() => md.render(props.content));
</script>

<style>
/* Global markdown styles (unscoped, applies to v-html content) */
.markdown-body {
    font-size: 13px;
    line-height: 1.6;
    word-wrap: break-word;
}
.markdown-body p { margin: 0 0 8px; }
.markdown-body p:last-child { margin-bottom: 0; }
.markdown-body code {
    background: var(--vscode-textCodeBlock-background);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 12px;
}
.markdown-body pre {
    background: var(--vscode-textCodeBlock-background);
    padding: 10px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 8px 0;
}
.markdown-body pre code {
    background: none;
    padding: 0;
}
.markdown-body ul, .markdown-body ol {
    padding-left: 20px;
    margin: 4px 0;
}
.markdown-body blockquote {
    border-left: 3px solid var(--vscode-textBlockQuote-border);
    padding-left: 10px;
    color: var(--vscode-textBlockQuote-foreground);
    margin: 8px 0;
}
</style>
