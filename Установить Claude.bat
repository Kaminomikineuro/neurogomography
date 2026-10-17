@echo off
chcp 65001 >nul
echo Ставлю Claude Code — чтобы Claude работал прямо в студии (чат «💬 Claude»).
echo.
rem Claude Code на Windows работает через Git Bash
if not exist "C:\Program Files\Git\bin\bash.exe" (
  echo Нужен Git для Windows. Ставлю...
  winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
  if errorlevel 1 (
    echo Не получилось поставить Git сам. Открываю страницу: скачай, установи с настройками по умолчанию и запусти этот файл снова.
    start https://git-scm.com/download/win
    pause
    exit /b
  )
)
echo.
echo Ставлю Claude Code...
call npm.cmd i -g @anthropic-ai/claude-code
if errorlevel 1 (
  echo.
  echo Не получилось установить. Сделай скриншот этого окна и пришли Claude.
  pause
  exit /b
)
echo.
echo Готово. Сейчас Claude спросит про оформление и попросит войти — войди своим аккаунтом Claude.
echo Когда увидишь поле для ввода, напиши /exit и нажми Enter.
pause
call claude.cmd
echo.
echo Всё. Перезапусти Студия.bat — внизу слева появится «💬 Claude».
pause
