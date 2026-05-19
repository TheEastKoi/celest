import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import * as path from 'node:path';

export default defineConfig({
    plugins: [vue()],
    root: path.resolve(__dirname),
    base: './',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: path.resolve(__dirname, 'index.html'),
            output: {
                entryFileNames: 'assets/[name].js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: 'assets/[name].[ext]',
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
});
