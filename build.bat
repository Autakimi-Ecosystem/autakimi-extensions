@echo off
echo ===========================================
echo   Building AutaKimi Extensions...
echo ===========================================
echo.

npx tsx build.ts

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
