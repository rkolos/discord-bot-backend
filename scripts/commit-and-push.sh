#!/usr/bin/env bash
# Скрипт для команды /коммит: проверка кода (lint, typecheck, build), затем коммит с сообщением и пуш.
# Сообщение коммита передаётся аргументом: ./scripts/commit-and-push.sh "заголовок" "тело сообщения"
# Или один аргумент: только заголовок.

set -e
cd "$(dirname "$0")/.."

echo "=== 1. Lint ==="
npm run lint

echo "=== 2. Typecheck ==="
npm run typecheck

echo "=== 3. Build ==="
npm run build

if ! git status --porcelain | read -r; then
  echo "Нет изменений для коммита (working tree clean)."
  exit 0
fi

HEADER="${1:-chore: update}"
BODY="${2:-}"

echo "=== 4. Commit & Push ==="
git add -A
if [ -n "$BODY" ]; then
  git commit -m "$HEADER" -m "$BODY"
else
  git commit -m "$HEADER"
fi
git push

echo "Готово: коммит создан и отправлен в origin."
