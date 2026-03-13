@echo off
SETLOCAL EnableDelayedExpansion

echo ===================================================
echo   RIDE SPRINT 3D PRINTER CALCULATOR // INITIALIZING...
echo ===================================================

:: Check for node_modules
if not exist "node_modules\" (
    echo [!] Missing dependencies. Running npm install...
    call npm install
)

:: Check if npm is installed
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not found. Please install Node.js.
    pause
    exit /b
)

echo [OK] Starting development server...
echo [OK] Opening browser at http://localhost:3003

:: Start the dev server in the background and open browser
start "" http://localhost:3003
call npm run dev

pause
