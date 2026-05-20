@echo off
setlocal
set PATH=D:\nodejs;%PATH%
cd /d "%~dp0"
D:\nodejs\node.exe node_modules\vitest\vitest.mjs run
pause
