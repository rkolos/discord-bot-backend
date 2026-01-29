#!/usr/bin/env sh
# Поднять все сервисы для разработки (3 БД + 5 приложений).
# Ожидается Colima (см. spec/03-04-colima-razrabotka.md). Запускать из корня: ./scripts/dev-up.sh

set -e
cd "$(dirname "$0")/.."

# Colima: подставить DOCKER_HOST, если не задан
if [ -z "$DOCKER_HOST" ]; then
  if [ -S "$HOME/.colima/default/docker.sock" ]; then
    export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"
  elif [ -S "$HOME/.colima/docker.sock" ]; then
    export DOCKER_HOST="unix://$HOME/.colima/docker.sock"
  fi
fi

if [ ! -f .env ]; then
  echo "Создаю .env из .env.example..."
  cp .env.example .env
fi

echo "Сборка образов..."
docker compose build

echo "Запуск всех контейнеров..."
docker compose up -d

echo "Готово. Контейнеры: postgres, redis, clickhouse, frontend-api, admin-api, bot-service, ingestor, background-worker"
echo "Логи: docker compose logs -f [имя-сервиса]"
