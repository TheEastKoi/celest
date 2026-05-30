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
    font-size: 14px;
    line-height: 1.85;
    word-wrap: break-word;
}
.markdown-body p { margin: 0 0 20px; }
.markdown-body p:last-child { margin-bottom: 0; }
.markdown-body code {
    background: var(--vscode-textCodeBlock-background);
    padding: 2px 5px;
    border-radius: 3px;
    font-size: 13px;
}
.markdown-body pre {
    background: var(--vscode-textCodeBlock-background);
    padding: 12px 14px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 18px 0;
}
.markdown-body pre code {
    background: none;
    padding: 0;
    font-size: 13px;
    line-height: 1.6;
}
.markdown-body ul, .markdown-body ol {
    padding-left: 24px;
    margin: 12px 0;
}
.markdown-body li { margin-bottom: 8px; }
.markdown-body li:last-child { margin-bottom: 0; }
.markdown-body h1, .markdown-body h2, .markdown-body h3,
.markdown-body h4, .markdown-body h5, .markdown-body h6 {
    margin: 24px 0 12px;
    line-height: 1.4;
}
.markdown-body h1:first-child, .markdown-body h2:first-child,
.markdown-body h3:first-child, .markdown-body h4:first-child,
.markdown-body h5:first-child, .markdown-body h6:first-child {
    margin-top: 0;
}
.markdown-body blockquote {
    border-left: 3px solid var(--vscode-textBlockQuote-border);
    padding: 6px 14px;
    color: var(--vscode-textBlockQuote-foreground);
    margin: 18px 0;
    border-radius: 0 4px 4px 0;
    background: var(--vscode-textBlockQuote-background);
}
.markdown-body hr {
    margin: 24px 0;
    border: none;
    border-top: 1px solid var(--vscode-panel-border);
}
.markdown-body table {
    margin: 18px 0;
}
</style>