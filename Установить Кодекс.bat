@echo off
chcp 65001 >nul
echo Устанавливаю Codex CLI...
call npm.cmd i -g @openai/codex
if errorlevel 1 (
  echo.
  echo Не получилось установить. Сделай скриншот этого окна и пришли Claude.
  pause
  exit /b
)
echo.
echo Готово. Сейчас откроется вход в ChatGPT — войди своим аккаунтом.
call codex.cmd login
echo.
echo Всё. Теперь запускай Студия.bat
pause
