#!/usr/bin/env sh
# Поднять только инфраструктуру (postgres, redis, clickhouse).
# API запускать локально: npm run start:dev:frontend-api и npm run start:dev:admin-api
# Решает проблему OOM при сборке NestJS в Docker.
set -e
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Создаю .env из .env.example..."
  cp .env.example .env
fi

echo "Запуск инфраструктуры (postgres, redis, clickhouse)..."
docker compose -f docker-compose.infra.yml up -d

echo ""
echo "Готово. Запустите API локально:"
echo "  npm run start:dev:frontend-api   # порт 3000"
echo "  npm run start:dev:admin-api      # порт 3001"
echo ""
echo "В .env для локального запуска должны быть:"
echo "  POSTGRES_HOST=localhost  DB_HOST=localhost"
echo "  REDIS_HOST=localhost  REDIS_PORT=6380"
echo "  CLICKHOUSE_HOST=localhost"
