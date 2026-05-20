const { spawn } = require('child_process');

const tui = spawn('E:\\git_code\\DeepSeek-TUI-new\\target\\release\\deepseek-tui.exe', 
    ['serve', '--acp'],
    { stdio: ['pipe', 'pipe', 'pipe'] }
);

let sessionId = '';
let buffer = '';

tui.stdout.on('data', d => {
    const text = d.toString();
    buffer += text;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
        if (!line.trim()) continue;
        try {
            const msg = JSON.parse(line);
            
            // Response to session/new
            if (msg.id === 2 && msg.result?.sessionId) {
                sessionId = msg.result.sessionId;
                console.log('[OK] Session:', sessionId);
                // Send prompt
                tui.stdin.write(JSON.stringify({
                    jsonrpc: '2.0', id: 3, method: 'session/prompt',
                    params: { sessionId, prompt: [{ type: 'text', text: '用一句话打招呼。' }] }
                }) + '\n');
            }
            
            // Streaming update
            if (msg.method === 'session/update') {
                const text = msg.params?.update?.content?.text || '';
                process.stdout.write(text);
            }
            
            // Prompt result
            if (msg.id === 3) {
                console.log('\n[OK] Done:', msg.result?.stopReason || 'complete');
            }
        } catch {}
    }
});

tui.stderr.on('data', d => {
    const err = d.toString();
    if (err.trim()) console.error('[TUI]', err.trim());
});

// Step 1: initialize
tui.stdin.write('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1}}\n');

// Step 2: new session
setTimeout(() => {
    tui.stdin.write('{"jsonrpc":"2.0","id":2,"method":"session/new","params":{"cwd":"E:/git_code"}}\n');
}, 500);

setTimeout(() => { tui.kill(); process.exit(0); }, 30000);
