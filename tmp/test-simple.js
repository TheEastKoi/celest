const { spawn } = require('child_process');
const p = spawn('E:/git_code/DeepSeek-TUI-new/target/release/deepseek-tui.exe', ['serve', '--acp'], { stdio: ['pipe', 'pipe', 'pipe'] });
p.stderr.on('data', d => console.log('[STDERR]', d.toString().trim()));
p.stdout.on('data', d => console.log('[STDOUT]', d.toString().trim()));
p.stdin.write('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1}}\n');
setTimeout(() => { p.kill(); process.exit(0); }, 5000);
