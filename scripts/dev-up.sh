#!/usr/bin/env sh
# Поднять все сервисы для разработки (3 БД + 5 приложений).
# Требуется Docker (см. spec/03-04-docker-razrabotka.md). Запускать из корня: ./scripts/dev-up.sh

set -e
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Создаю .env из .env.example..."
  cp .env.example .env
fi

# Очистка Docker от мусора перед сборкой (освобождает место; именованные тома БД не трогаем)
echo "Очистка Docker (остановленные контейнеры, кэш сборки, висячие образы, анонимные тома)..."
docker container prune -f 2>/dev/null || true
docker image prune -f 2>/dev/null || true
docker builder prune -f 2>/dev/null || true
docker network prune -f 2>/dev/null || true
# Удаляем только анонимные тома (64-символьный hex) — старые node_modules и т.п.; postgres_data, redis_data, clickhouse_data не трогаем
docker volume ls -q 2>/dev/null | while read -r v; do
  [ -z "$v" ] && continue
  echo "$v" | grep -qE '^[0-9a-f]{64}$' && docker volume rm "$v" 2>/dev/null || true
done

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

echo "Запуск всех контейнеров (start:dev — авто-пересборка при изменениях в коде)..."
docker compose up -d

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
