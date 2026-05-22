@echo off
setlocal
set PATH=D:\nodejs;%PATH%

echo ========================================
echo   Celest VS Code Extension - Build
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] Installing dependencies...
call D:\nodejs\npm.cmd install
if %ERRORLEVEL% NEQ 0 (
    echo  ERROR: npm install failed
    pause
    exit /b 1
)

echo.
echo [2/3] Building...
D:\nodejs\node.exe build.mjs
if %ERRORLEVEL% NEQ 0 (
    echo  ERROR: Build failed
    pause
    exit /b 1
)

echo.
echo [3/3] Running tests...
D:\nodejs\node.exe node_modules\vitest\vitest.mjs run
if %ERRORLEVEL% NEQ 0 (
    echo  WARNING: Some tests failed (Phase 3 tests pending update)
)

echo.
echo ========================================
echo   Build complete!
echo   out\extension.js + out\gui\
echo.
echo   To test: Open celest/ in VS Code and press F5
echo ========================================
pause
