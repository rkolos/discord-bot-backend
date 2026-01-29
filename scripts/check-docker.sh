#!/usr/bin/env sh
# Проверка доступности Docker (проект настроен на Colima).
# Запускайте в своём терминале (не через агента).

echo "=== Проверка Docker (Colima) ==="
echo ""

if ! command -v docker >/dev/null 2>&1; then
  echo "Ошибка: команда 'docker' не найдена."
  echo "Установите Colima и Docker CLI: ./scripts/install-docker-colima.sh"
  echo "Или: brew install colima docker"
  exit 1
fi

echo "1. Docker CLI найден: $(docker --version)"
echo ""

# Подставить DOCKER_HOST для Colima, если не задан и сокет есть
if [ -z "$DOCKER_HOST" ]; then
  if [ -S "$HOME/.colima/default/docker.sock" ]; then
    export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"
    echo "2. DOCKER_HOST задан для Colima (default): $DOCKER_HOST"
  elif [ -S "$HOME/.colima/docker.sock" ]; then
    export DOCKER_HOST="unix://$HOME/.colima/docker.sock"
    echo "2. DOCKER_HOST задан для Colima: $DOCKER_HOST"
  fi
  echo ""
fi

echo "3. Подключение к демону..."
if docker info >/dev/null 2>&1; then
  echo "   OK — демон доступен."
  echo ""
  echo "4. Контейнеры:"
  docker ps -a --format "   {{.Names}}\t{{.Status}}\t{{.Ports}}"
  echo ""
  echo "Docker (Colima) работает. Запуск: docker compose build && docker compose up -d"
else
  echo "   Ошибка: не удаётся подключиться к демону."
  echo ""
  echo "Что сделать (Colima):"
  echo "  • Запустите Colima: colima start"
  echo "  • Если DOCKER_HOST не подставляется автоматически, добавьте в ~/.zshrc:"
  echo "    export DOCKER_HOST=\"unix://\$HOME/.colima/default/docker.sock\""
  echo "  • Запустите этот скрипт в обычном терминале (не через агента Cursor)."
  exit 1
fi
