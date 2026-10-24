#!/bin/bash
cd "$(dirname "$0")/../.."
echo "Какую главу рисовать? 37, 38, 39, E или all (Enter = all)"
read CH
node "Иллюстрации книга/Т2 гл37-39 и Эпилог/tools/run.mjs" "${CH:-all}"
read -p "Нажми Enter, чтобы закрыть"
