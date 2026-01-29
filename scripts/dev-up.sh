#!/usr/bin/env sh
# Поднять все сервисы для разработки (3 БД + 5 приложений).
# Запускать из корня проекта: ./scripts/dev-up.sh

set -e
cd "$(dirname "$0")/.."

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
