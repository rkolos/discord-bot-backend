#!/usr/bin/env sh
# Проверка доступности Docker. Запускайте в своём терминале (не через агента).

echo "=== Проверка Docker ==="
echo ""

if ! command -v docker >/dev/null 2>&1; then
  echo "Ошибка: команда 'docker' не найдена. Установите Docker Desktop для Mac."
  exit 1
fi

echo "1. Docker CLI найден: $(docker --version)"
echo ""

echo "2. Подключение к демону..."
if docker info >/dev/null 2>&1; then
  echo "   OK — демон доступен."
  echo ""
  echo "3. Контейнеры:"
  docker ps -a --format "   {{.Names}}\t{{.Status}}\t{{.Ports}}"
  echo ""
  echo "Docker работает. Можете запускать: docker compose build && docker compose up -d"
else
  echo "   Ошибка: не удаётся подключиться к демону."
  echo ""
  echo "Что сделать:"
  echo "  • Откройте Docker Desktop и дождитесь зелёного индикатора."
  echo "  • Если уже открыт — выйдите (Quit) и запустите снова."
  echo "  • Запустите этот скрипт в обычном терминале (не через агента Cursor)."
  exit 1
fi
