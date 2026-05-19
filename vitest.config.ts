import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.test.ts'],
        },
    },
    resolve: {
        alias: {
            vscode: __dirname + '/test/mocks/vscode-module.ts',
        },
    },
});
