import * as esbuild from 'esbuild';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const outDir = path.join(root, 'out');
const guiOutDir = path.join(outDir, 'gui');

function copyGuiOutput() {
    const guiDist = path.join(root, 'gui', 'dist');
    if (!fs.existsSync(guiDist)) {
        console.warn('⚠ GUI dist not found at', guiDist);
        return;
    }
    fs.rmSync(guiOutDir, { recursive: true, force: true });
    fs.mkdirSync(guiOutDir, { recursive: true });
    fs.cpSync(guiDist, guiOutDir, { recursive: true });
    console.log('✅ GUI copied to', path.relative(root, guiOutDir));
}

function runViteBuild() {
    console.log('\n=== Building Vue GUI ===');
    const guiDir = path.join(root, 'gui');
    const isWindows = process.platform === 'win32';
    const viteBin = path.join(root, 'node_modules', '.bin', isWindows ? 'vite.cmd' : 'vite');
    try {
        execSync(`"${viteBin}" build`, {
            cwd: guiDir,
            stdio: 'inherit',
            timeout: 60000,
            shell: true,
        });
        console.log('✅ GUI built');
    } catch (e) {
        console.error('❌ GUI build failed');
        throw e;
    }
}

async function buildExtension() {
    console.log('\n=== Building Celest Extension ===');
    fs.mkdirSync(outDir, { recursive: true });

    await esbuild.build({
        entryPoints: [path.join(root, 'src', 'extension.ts')],
        outfile: path.join(outDir, 'extension.js'),
        bundle: true,
        external: ['vscode'],
        format: 'cjs',
        platform: 'node',
        sourcemap: true,
        logLevel: 'info',
    });
    const stats = fs.statSync(path.join(outDir, 'extension.js'));
    console.log(`✅ Extension built: ${(stats.size / 1024).toFixed(1)} KB`);
}

async function main() {
    const watchMode = process.argv.includes('--watch');
    runViteBuild();
    copyGuiOutput();
    await buildExtension();
    if (watchMode) {
        console.log('\n👀 Watching for changes... (not yet implemented for watch)');
    }
}

main().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
