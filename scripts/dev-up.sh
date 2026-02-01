#!/usr/bin/env sh
# Поднять все сервисы для разработки (3 БД + 5 приложений).
# Требуется Docker (см. spec/03-04-docker-razrabotka.md). Запускать из корня: ./scripts/dev-up.sh

set -e
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Создаю .env из .env.example..."
  cp .env.example .env
fi

PG_USER="postgres"
PG_DB="sn"
if [ -f .env ]; then
  _u=$(grep -E '^POSTGRES_USER=' .env 2>/dev/null | cut -d= -f2-)
  _d=$(grep -E '^POSTGRES_DB=' .env 2>/dev/null | cut -d= -f2-)
  [ -n "$_u" ] && PG_USER="$_u"
  [ -n "$_d" ] && PG_DB="$_d"
fi

echo "Сборка образов..."
docker compose build

echo "Запуск всех контейнеров (без watch — изменения применяются только после перезапуска)..."
NEST_START_CMD=start docker compose up -d

echo "Ожидание готовности PostgreSQL..."
sleep 5
until docker compose exec -T postgres pg_isready -U "$PG_USER" -d "$PG_DB" 2>/dev/null; do
  sleep 2
done

echo "Применение миграций..."
POSTGRES_HOST=localhost npm run migration:run

echo "Проверка сидеров..."
SEEDED=$(docker compose exec -T postgres psql -U "$PG_USER" -d "$PG_DB" -tAc "SELECT 1 FROM admin_users WHERE email='admin@server-ninja.local' LIMIT 1" 2>/dev/null || echo "")
if [ "$SEEDED" = "1" ]; then
  echo "Сидеры уже применены (admin@server-ninja.local найден), пропуск."
else
  echo "Накат сидеров..."
  POSTGRES_HOST=localhost REDIS_HOST=localhost REDIS_PORT=6380 CLICKHOUSE_HOST=localhost npm run seed
fi

echo "Готово. Контейнеры: postgres, redis, clickhouse, frontend-api, admin-api, bot-service, ingestor, background-worker"
echo "Слежение за логами (Ctrl+C — выход, контейнеры продолжат работу)..."
docker compose logs -f
