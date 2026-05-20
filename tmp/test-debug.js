const { spawn } = require('child_process');
const readline = require('readline');

const bin = 'E:/git_code/DeepSeek-TUI-new/target/release/deepseek-tui.exe';

console.log('1. Spawning process...');
const p = spawn(bin, ['serve', '--acp'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: 'E:/git_code',
});

let fullStdout = '';
let fullStderr = '';

p.stdout.on('data', d => {
    fullStdout += d.toString();
    console.log('[STDOUT RAW]', JSON.stringify(d.toString()));
});

p.stderr.on('data', d => {
    fullStderr += d.toString();
    console.log('[STDERR]', d.toString().trim());
});

p.on('error', e => console.error('[SPAWN ERROR]', e.message));
p.on('exit', code => console.log('[EXIT]', code));

// Wait a moment for startup, then send initialize
setTimeout(() => {
    const req = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1}}\n';
    console.log('2. Sending:', req.trim());
    p.stdin.write(req);
    
    // Wait for response
    setTimeout(() => {
        if (fullStdout.trim()) {
            console.log('3. All stdout:', fullStdout);
        } else {
            console.log('3. NO stdout received!');
        }
        p.kill();
        process.exit(0);
    }, 5000);
}, 500);
