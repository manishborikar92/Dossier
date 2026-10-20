@echo off
REM Resume Studio launcher for Windows. Double-click this file.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20.9 or newer was not found. Install the LTS version from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies - first run only, needs internet...
  call npm install
  if errorlevel 1 ( echo npm install failed. & pause & exit /b 1 )
)

if not exist .next (
  echo Building the app - first run only, takes about a minute...
  call npm run build
  if errorlevel 1 ( echo Build failed. & pause & exit /b 1 )
)

if not exist data\profile.json (
  echo Creating your starting data from seed files...
  call npm run seed
)

echo.
echo Resume Studio is starting at http://localhost:3000  (close this window to stop it)
start "" cmd /c "timeout /t 4 >nul & start http://localhost:3000"
call npm start
pause
