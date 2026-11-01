@echo off
chcp 65001 >nul
title Ihtal Almamlaka - sync server
cd /d "%~dp0"
echo.
echo   ===  Ihtal Almamlaka - starting  ===
echo.
if not exist node_modules (
  echo Installing packages for the first time...
  call npm install
)
call npm run build
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)
start "" "http://localhost:8787/#/host"
echo.
echo   The game opens at http://localhost:8787  (host panel: /#/host)
echo   OBS Browser Source and phone links are printed below, and in the host panel button "الجوال وOBS".
echo   Keep this window open while playing. Close it to stop the server.
echo.
node relay/server.mjs
pause
