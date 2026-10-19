@echo off
chcp 65001 >nul
cd /d "%~dp0..\.."
echo Какую главу рисовать? 37, 38, 39, E или all (Enter = all)
set /p CH=
if "%CH%"=="" set CH=all
node "Иллюстрации книга\Т2 гл37-39 и Эпилог\tools\run.mjs" %CH%
pause
