@echo off
setlocal
set PATH=D:\nodejs;%PATH%
echo ========================================
echo   Celest HTTP/SSE 诊断测试
echo ========================================
echo.

echo [1] 检查 deepseek-tui 版本
deepseek-tui --version 2>nul || deepseek --version 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] deepseek-tui not found in PATH
    echo   Try: where deepseek-tui
    goto :end
)
echo.

echo [2] 检查 API Key 配置
deepseek doctor --json > tmp\_doctor.json 2>nul 
if %ERRORLEVEL% EQU 0 (
    echo [OK] doctor output saved:
    D:\nodejs\node.exe -e "const d=require('./tmp/_doctor.json'); console.log('  api_key.source:',d.api_key?.source); console.log('  default_model:',d.default_text_model);" 2>nul
) else (
    echo [FAIL] deepseek doctor failed - API key may not be configured
)
echo.

echo [3] 尝试启动 HTTP 服务器 (port 8787)...
echo   启动命令: deepseek-tui serve --http --port 8787 --host 127.0.0.1 --insecure --workers 1
start "DeepSeek-TUI-HTTP" /B deepseek-tui serve --http --port 8787 --host 127.0.0.1 --insecure --workers 1 > tmp\_tui.log 2>&1
echo   等待启动...
timeout /t 5 /nobreak >nul

echo.
echo   检查进程:
tasklist 2>nul | findstr deepseek-tui
echo.
echo   服务日志 (最后10行):
type tmp\_tui.log 2>nul
echo.

echo [4] 测试 /health 端点
D:\nodejs\node.exe -e "fetch('http://127.0.0.1:8787/health').then(r=>r.text()).then(t=>console.log('[OK] Health:',t)).catch(e=>console.log('[FAIL] Health:',e.message))" 2>nul
echo.

echo [5] 测试 /v1/stream 端点 (发送简单 prompt)
D:\nodejs\node.exe -e "
const body = JSON.stringify({prompt:'hello, say hi',allow_shell:false,trust_mode:true,auto_approve:true});
fetch('http://127.0.0.1:8787/v1/stream',{method:'POST',headers:{'Content-Type':'application/json'},body}).then(r=>{
    console.log('Status:',r.status);
    return r.text();
}).then(t=>console.log('Response (first 500 chars):',t.slice(0,500))).catch(e=>console.log('[FAIL] Stream:',e.message));
" 2>nul
echo.

echo [6] 清理 - 关闭测试服务器
taskkill /f /im deepseek-tui.exe >nul 2>&1

echo.
echo ========================================
echo   诊断完成
echo ========================================
:end
pause
