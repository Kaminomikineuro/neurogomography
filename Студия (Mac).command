#!/bin/bash
# Запуск студии на Mac: двойной клик по этому файлу
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Нужен Node.js: https://nodejs.org (кнопка LTS). Установи и запусти снова."
  open https://nodejs.org
  read -n 1 -p "Нажми любую клавишу…"
  exit 1
fi
node studio/server.mjs --open
