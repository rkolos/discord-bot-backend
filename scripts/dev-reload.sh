#!/usr/bin/env sh
# Быстрая перезагрузка только тех контейнеров приложений, в чьём коде были изменения.
# Использует git для определения изменённых файлов (рабочая копия и индекс против HEAD).
# Запускать из корня: ./scripts/dev-reload.sh
# Опция: --all — перезапустить все приложения (frontend-api, admin-api, bot-service, ingestor-worker, background-worker).

set -e
cd "$(dirname "$0")/.."

APP_SERVICES="frontend-api admin-api bot-service ingestor-worker background-worker"

# Определяем изменённые файлы (незакоммиченные: индекс + рабочая копия)
CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null || true)
if [ -z "$CHANGED_FILES" ]; then
  case "${1:-}" in
    --all)
      echo "Перезапуск всех приложений (--all)..."
      NEST_START_CMD=start docker compose restart $APP_SERVICES
      echo "Готово."
      exit 0
      ;;
    *)
      echo "Нет изменений в рабочей копии (git diff HEAD). Для перезапуска всех приложений: ./scripts/dev-reload.sh --all"
      exit 0
      ;;
  esac
fi

if [ "${1:-}" = "--all" ]; then
  echo "Перезапуск всех приложений (--all)..."
  NEST_START_CMD=start docker compose restart $APP_SERVICES
  echo "Готово."
  exit 0
fi

# Собираем список сервисов для перезапуска по путям
TO_RESTART=""
for file in $CHANGED_FILES; do
  case "$file" in
    apps/frontend-api/*)  TO_RESTART="$TO_RESTART frontend-api" ;;
    apps/admin-api/*)     TO_RESTART="$TO_RESTART admin-api" ;;
    apps/bot-service/*)   TO_RESTART="$TO_RESTART bot-service" ;;
    apps/ingestor-worker/*) TO_RESTART="$TO_RESTART ingestor-worker" ;;
    apps/background-worker/*) TO_RESTART="$TO_RESTART background-worker" ;;
    libs/*)               TO_RESTART="$TO_RESTART frontend-api admin-api bot-service ingestor-worker background-worker" ;;
    # корневые Dockerfile/package — перезапускаем все приложения
    Dockerfile|package.json|package-lock.json)
      echo "Обнаружены изменения в $file — перезапуск всех приложений."
      NEST_START_CMD=start docker compose restart $APP_SERVICES
      echo "Готово."
      exit 0
      ;;
  esac
done

# Убираем дубликаты и лишние пробелы, сортируем
TO_RESTART=$(echo "$TO_RESTART" | tr ' ' '\n' | sort -u | tr '\n' ' ')
TO_RESTART=$(echo "$TO_RESTART" | xargs)

if [ -z "$TO_RESTART" ]; then
  echo "Изменения не затрагивают код приложений (apps/*, libs/*). Перезапуск не выполняется."
  echo "Для перезапуска всех приложений: ./scripts/dev-reload.sh --all"
  exit 0
fi

echo "Перезапуск сервисов по изменённым файлам: $TO_RESTART"
NEST_START_CMD=start docker compose restart $TO_RESTART
echo "Готово."
