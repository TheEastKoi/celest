import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import * as path from 'node:path';

export default defineConfig({
    plugins: [vue()],
    test: {
        globals: true,
        environmentMatchGlobs: [
            ['gui/**/*.test.ts', 'jsdom'],
            ['src/**/*.test.ts', 'node'],
            ['test/**/*.test.ts', 'node'],
        ],
        include: ['src/**/*.test.ts', 'test/**/*.test.ts', 'gui/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts', 'gui/src/**/*.vue'],
            exclude: ['**/*.test.ts'],
        },
    },
    resolve: {
        alias: {
            vscode: __dirname + '/test/mocks/vscode-module.ts',
            '@': path.resolve(__dirname, 'gui/src'),
        },
    },
});