const { spawn } = require('child_process');

const tui = spawn('E:\\git_code\\DeepSeek-TUI-new\\target\\release\\deepseek-tui.exe', 
    ['serve', '--acp'],
    { stdio: ['pipe', 'pipe', 'pipe'] }
);

let output = '';

tui.stdout.on('data', d => { 
    const text = d.toString();
    process.stdout.write(text);
    output += text;
});

tui.stderr.on('data', d => { 
    process.stderr.write('STDERR: ' + d.toString());
});

tui.on('close', code => {
    process.exit(code || 0);
});

setTimeout(() => { 
    tui.kill(); 
}, 5000);

process.stdin.on('data', d => { tui.stdin.write(d); });
