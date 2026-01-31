# 3.4. Локальная разработка: Docker

> Для локальной разработки и тестов используется **Docker** (Docker Desktop или docker + docker compose).

## Установка Docker

1. **macOS/Windows:** установите [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. **Linux:** установите docker и docker compose:
   ```bash
   # Ubuntu/Debian
   sudo apt-get update && sudo apt-get install docker.io docker-compose-plugin
   ```
3. Или через скрипт: `./scripts/install-docker.sh`

## Сборка и запуск проекта

1. Убедиться, что Docker запущен: `docker info` (или `./scripts/check-docker.sh`)
2. Поднять сервисы:
   ```bash
   ./scripts/dev-up.sh
   ```
   Или вручную: `docker compose build && docker compose up -d`
3. API доступны: Frontend `http://localhost:3002`, Admin `http://localhost:3001`

## Запуск только инфраструктуры (если API в Docker падают по OOM)

При нехватке памяти (код выхода 137) — API-приложения могут не собраться в контейнерах. Альтернатива:

```bash
./scripts/dev-up-infra.sh
# Затем в двух терминалах:
npm run start:dev:frontend-api   # http://localhost:3000
npm run start:dev:admin-api      # http://localhost:3001
```

В `.env` для локального запуска: `POSTGRES_HOST=localhost`, `DB_HOST=localhost`, `REDIS_HOST=localhost`, `REDIS_PORT=6380`, `CLICKHOUSE_HOST=localhost`.

## Тесты

- **Юнит-тесты** не требуют Docker.
- **Интеграционные тесты** (PostgreSQL, Redis, ClickHouse через Testcontainers) требуют работающий Docker:
  - Запустите Docker Desktop (или docker daemon) перед `npm run test`.

Если при `npm run test` появляется ошибка *"Could not find a working container runtime strategy"*:
1. Docker запущен: `docker info`
2. Запустите тесты в обычном терминале (не через агента).

## Нюансы

- **Первый запуск интеграционных тестов** может быть дольше: Testcontainers скачивает образы (Postgres, Redis, ClickHouse).
- **Порты:** в `docker-compose.yml` порты БД проброшены на хост (5432, 6380, 8123); при локальном запуске приложений без Docker используйте в `.env` значения для localhost (см. `.env.example`).

## См. также

- [3.3. Инфраструктура](./03-03-infrastruktura.md) — общая схема развёртывания и окружений.
- Скрипты: `scripts/install-docker.sh`, `scripts/check-docker.sh`, `scripts/dev-up.sh`.
