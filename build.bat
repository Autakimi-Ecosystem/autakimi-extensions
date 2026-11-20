@echo off
setlocal
cd /d "%~dp0"

echo ===========================================
echo   Building AutaKimi Extensions...
echo ===========================================
echo.

call npm run build

echo.
if %ERRORLEVEL% NEQ 0 (
    echo ===========================================
    echo   [ERROR] Build failed with code %ERRORLEVEL%.
    echo ===========================================
    pause
    exit /b %ERRORLEVEL%
)

echo ===========================================
echo   [SUCCESS] Build completed successfully.
echo ===========================================
pause
