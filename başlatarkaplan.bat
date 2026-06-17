@echo off
chcp 65001 >nul
setlocal

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "SRC=%ROOT%\src"
set "NODE_VER=20.18.1"

echo Checking for nvm...

where nvm >nul 2>&1
if %errorlevel% equ 0 (
  echo nvm found, checking Node.js version...
  nvm ls | findstr "%NODE_VER%" >nul 2>&1
  if %errorlevel% neq 0 (
    echo Installing Node.js %NODE_VER%...
    nvm install %NODE_VER%
  )
  echo Using Node.js %NODE_VER%...
  nvm use %NODE_VER% >nul 2>&1
) else (
  echo nvm not found, using system Node.js...
)

echo.
echo Starting background PowerShell launcher...
start "" wscript.exe "%SRC%\run_hidden.vbs" "%SRC%\run_launcher_background.ps1"

exit /b 0
