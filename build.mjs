import * as esbuild from 'esbuild';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const outDir = path.join(root, 'out');

async function buildExtension() {
    console.log('\n=== Building Celest Extension ===');

    const result = await esbuild.build({
        entryPoints: [path.join(root, 'src', 'extension.ts')],
        outfile: path.join(outDir, 'extension.js'),
        bundle: true,
        external: ['vscode'],
        format: 'cjs',
        platform: 'node',
        sourcemap: true,
        logLevel: 'info',
    });

    if (result.errors.length > 0) {
        console.error('❌ Extension build FAILED:', result.errors);
        process.exit(1);
    }

    const stats = fs.statSync(path.join(outDir, 'extension.js'));
    console.log(`✅ Extension built: ${(stats.size / 1024).toFixed(1)} KB`);
}

buildExtension().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
