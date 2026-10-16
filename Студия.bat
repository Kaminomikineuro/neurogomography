@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Нужен Node.js: https://nodejs.org ^(кнопка LTS^). Установи и запусти снова.
  start https://nodejs.org
  pause
  exit /b
)
node studio\server.mjs --open
pause
