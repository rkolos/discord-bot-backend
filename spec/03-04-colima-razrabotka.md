# 3.4. Локальная разработка: Colima (Docker без Docker Desktop)

> В проекте для локальной разработки и тестов используется **Colima** как Docker-демон (вместо Docker Desktop). Это позволяет запускать контейнеры и интеграционные тесты без установки Docker Desktop на macOS.

## Зачем Colima

- **Без GUI:** только CLI, меньше ресурсов.
- **Совместимость:** стандартный Docker API, `docker` и `docker compose` работают как обычно.
- **Тесты:** Testcontainers (интеграционные тесты) подхватывают демон через `DOCKER_HOST`.

## Установка и первый запуск

1. Установить Colima и Docker CLI (если ещё не установлены):
   ```bash
   ./scripts/install-docker-colima.sh
   ```
   Или вручную: `brew install colima docker`

2. Запустить Colima (создаётся VM с Docker-демоном):
   ```bash
   colima start
   ```

3. Проверить доступность Docker:
   ```bash
   ./scripts/check-docker.sh
   ```

## Переменная DOCKER_HOST

Colima выставляет сокет не в стандартное место (`/var/run/docker.sock`), а, как правило, в:

- `~/.colima/default/docker.sock` (профиль default)

Чтобы `docker`, `docker compose` и **Jest с Testcontainers** видели демон:

- Скрипт **check-docker.sh** при необходимости сам подставляет `DOCKER_HOST` в текущую сессию.
- **Jest** (unit + integration тесты) при запуске подставляет `DOCKER_HOST` через `scripts/jest-e2e-colima-setup.js` (указан в `jest.config.js` и `jest.e2e.config.js`).

Если в вашей среде сокет в другом пути (например, другой профиль Colima), задайте вручную перед тестами и сборкой:

```bash
export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"
```

Чтобы не вводить каждый раз, добавьте в `~/.zshrc`:

```bash
if [ -S "$HOME/.colima/default/docker.sock" ]; then
  export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"
fi
```

## Сборка и запуск проекта

1. Убедиться, что Colima запущен: `colima status` (или `./scripts/check-docker.sh`).
2. Поднять сервисы:
   ```bash
   ./scripts/dev-up.sh
   ```
   Или вручную: `docker compose build && docker compose up -d`.
3. Остановить Colima при необходимости: `colima stop`; снова запустить: `colima start`.

Все образы и контейнеры управляются через обычный `docker`/`docker compose`; Colima лишь предоставляет демон.

## Тесты

- **Юнит-тесты** не требуют Docker.
- **Интеграционные тесты** (PostgreSQL, Redis, ClickHouse через Testcontainers) требуют работающий Docker-демон. При использовании Colima:
  - Запустите `colima start` перед `npm run test`.
  - Jest при старте подставит `DOCKER_HOST` из скрипта `jest-e2e-colima-setup.js`, если сокет Colima найден.

Если при `npm run test` появляется ошибка вида *"Could not find a working container runtime strategy"*, проверьте:

1. Colima запущен: `colima status`.
2. В терминале без предустановленного `DOCKER_HOST` сокет доступен: `ls -la ~/.colima/default/docker.sock`.
3. При необходимости задайте `DOCKER_HOST` вручную (см. выше).

## Нюансы

- **Первый запуск интеграционных тестов** может быть дольше: Testcontainers скачивает образы (Postgres, Redis, ClickHouse).
- **IPv4:** в `jest-e2e-colima-setup.js` задаётся `NODE_OPTIONS=--dns-result-order=ipv4first`, чтобы избежать задержек/ошибок DNS в контейнерах (Lima/Colima без IPv6).
- **Порты:** в `docker-compose.yml` порты БД проброшены на хост (5432, 6380, 8123 и т.д.); при локальном запуске приложений без Docker используйте в `.env` значения для localhost (см. `.env.example`).

## См. также

- [3.3. Инфраструктура](./03-03-infrastruktura.md) — общая схема развёртывания и окружений.
- Скрипты: `scripts/install-docker-colima.sh`, `scripts/check-docker.sh`, `scripts/dev-up.sh`.
