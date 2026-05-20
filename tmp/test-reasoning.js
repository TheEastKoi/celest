const { spawn } = require('child_process');

const bin = 'E:/git_code/DeepSeek-TUI-new/target/release/deepseek-tui.exe';

console.log('=== ACP Reasoning Test ===\n');

const p = spawn(bin, ['serve', '--acp'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: 'E:/git_code',
});

let buffer = '';
let events = [];

p.stdout.on('data', d => {
    buffer += d.toString();
    while (buffer.includes('\n')) {
        const idx = buffer.indexOf('\n');
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
            const msg = JSON.parse(line);
            if (msg.method === 'session/update') {
                const c = msg.params?.update?.content;
                const cType = c?.type || '?';
                const su = msg.params?.update?.sessionUpdate || '';
                const preview = JSON.stringify(c).slice(0, 150);
                console.log(`[UPDATE] type=${cType} su=${su}`);
                console.log(`  content: ${preview}`);
                events.push({ type: cType, sessionUpdate: su });
            }
            if (msg.result?.sessionId) {
                sessionId = msg.result.sessionId;
                console.log(`[SESSION] ${sessionId}`);
            }
        } catch (_) {}
    }
});

p.stderr.on('data', d => {
    const t = d.toString().trim();
    if (t) console.log('[STDERR]', t.slice(0, 200));
});

p.on('exit', code => console.log('[EXIT]', code));

let sessionId = null;

setTimeout(() => { console.log('\n[TIMEOUT]'); p.kill(); process.exit(1); }, 120000);

// Step 1: Init
setTimeout(() => {
    console.log('--- init ---');
    p.stdin.write('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1}}\n');
}, 500);

// Step 2: New session  
setTimeout(() => {
    console.log('--- session/new ---');
    p.stdin.write('{"jsonrpc":"2.0","id":2,"method":"session/new","params":{"cwd":"E:/git_code"}}\n');
}, 2000);

// Step 3: Prompt
setTimeout(() => {
    if (!sessionId) { console.log('No sessionId yet, retrying...'); return; }
    console.log('--- prompt ---');
    const req = JSON.stringify({
        jsonrpc: '2.0', id: 3, method: 'session/prompt',
        params: { sessionId, prompt: [{ type: 'text', text: '用中文回答：1+1等于几' }] }
    });
    p.stdin.write(req + '\n');
}, 5000);

// Fallback prompt with retry
setTimeout(() => {
    if (!sessionId) { console.log('FATAL: no session'); p.kill(); process.exit(1); }
    console.log('--- prompt (retry) ---');
    const req = JSON.stringify({
        jsonrpc: '2.0', id: 4, method: 'session/prompt',
        params: { sessionId, prompt: [{ type: 'text', text: '用中文回答：1+1等于几' }] }
    });
    p.stdin.write(req + '\n');
}, 8000);

// Summarize
setTimeout(() => {
    console.log('\n=== Summary ===');
    console.log('Total updates:', events.length);
    console.log('Types:', events.map(e => e.type));
    const hasReasoning = events.some(e => e.type === 'reasoning' || e.type === 'thinking');
    console.log(hasReasoning ? '✅ Reasoning DETECTED' : '❌ No reasoning');
    p.kill();
    process.exit(hasReasoning ? 0 : 1);
}, 30000);
