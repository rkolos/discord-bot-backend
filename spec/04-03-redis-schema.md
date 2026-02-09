# 4.3. Redis Schema

> **Важное примечание:** Перед началом реализации необходимо детально изучить всю документацию в папке `ABOUT/` и её подпапках (`API_SPEC_ADMIN`, `API_SPEC_FRONT`), а также ознакомиться с уже описанными пунктами в папке `spec/` для полного понимания контекста и текущих архитектурных решений.

Документ фиксирует структуру ключей Redis для кэша, сессий, Streams и очередей BullMQ.

## 4.3.1 Общие правила нейминга и изоляции

- **Префикс окружения** обязателен для всех ключей: `sn:{env}:...`, где `{env}` ∈ `dev|stage|prod`.
- **Префикс сервиса** в ключах обязателен для multi‑service: `sn:{env}:{service}:...`.
- **Разделение по назначению**: `auth:*`, `cache:*`, `stream:*`, `queue:*`, `ratelimit:*`.
- **TTL** задается на уровне ключей для кэша и сессий.

Пример общего формата:
```
sn:prod:frontend-api:auth:session:{sessionId}
```

## 4.3.2 Сессии и аутентификация

### Пользовательские сессии (Frontend API)

- `sn:{env}:frontend-api:auth:session:{sessionId}`
  - **Тип:** HASH
  - **TTL:** 7–30 дней (в зависимости от политики refresh)
  - **Поля:** `user_id`, `created_at`, `expires_at`, `ip`, `user_agent`

### Админские сессии (Admin API)

- `sn:{env}:admin-api:auth:session:{sessionId}`
  - **Тип:** HASH
  - **TTL:** 1–7 дней
  - **Поля:** `admin_id`, `role`, `created_at`, `expires_at`, `ip`, `user_agent`

### Отозванные токены (Blacklist)

- `sn:{env}:auth:revoked:{jti}`
  - **Тип:** STRING (маркер, например `1`)
  - **TTL:** не меньше максимального срока жизни токена
  - **Назначение:** быстрая проверка, что access/refresh токен с данным `jti` отозван

> **Примечание:** Если refresh‑токены хранятся только в PostgreSQL, в Redis допускается хранить только активные сессии и их быстрый revoke.
> Refresh‑токены и их хеши хранятся в PostgreSQL (см. `spec/04-01-postgresql.md`), Redis используется для моментального revoke (blacklist по `jti`) и при необходимости для кэша активных сессий.

## 4.3.3 Кэш и метаданные

- `sn:{env}:{service}:cache:user:{userId}` — кэш профиля пользователя (TTL 5–30 мин).
- `sn:{env}:{service}:cache:guild:{guildId}` — кэш гильдии и статусов (TTL 5–30 мин).
- `sn:{env}:{service}:cache:settings:{guildId}` — кэш настроек гильдии (TTL 1–5 мин).

## 4.3.4 Rate Limiting

- `sn:{env}:{service}:ratelimit:ip:{ip}` — лимиты по IP.
- `sn:{env}:{service}:ratelimit:user:{userId}` — лимиты по пользователю.
- `sn:{env}:{service}:ratelimit:guild:{guildId}` — лимиты по гильдии (например, операции с каунтерами).

**TTL:** 1–60 минут в зависимости от политики (например, 100 req/min).

## 4.3.4.1 Heartbeat шардов (Bot Service)

- `sn:{env}:bot-service:shard:{shardId}`
  - **Тип:** HASH
  - **TTL:** 60 секунд (обновляется каждые 30 секунд воркером шарда)
  - **Поля:** `status`, `timestamp`, `guildCount`, `ping` (опционально)
  - **Назначение:** отображение состояния шардов в Admin API и обнаружение зависших шардов (см. `spec/06-04-upravlenie-botami.md`).

## 4.3.5 Redis Streams (Event Pipeline)

### События Discord

- `sn:{env}:bot-service:stream:discord:events`
  - **Тип:** Stream
  - **Producer:** Bot Service
  - **Consumer Group:** `ingestor`
  - **Consumer:** Ingestor Worker

**Payload (минимум):** `event_id`, `event_type`, `event_time`, `guild_id`, `user_id`, `channel_id`, `payload`.

### Dead‑letter (ошибки ингестии)

- `sn:{env}:ingestor:stream:discord:events:dlq`
  - **Тип:** Stream
  - **Producer:** Ingestor Worker (при превышении retry)
  - **Consumer:** Admin/Monitoring Worker

## 4.3.6 BullMQ очереди

### Обновление каунтеров

- `sn:{env}:workers:queue:counters:update`
  - **Назначение:** задачи на обновление названий каналов
  - **Producer:** Frontend API / Scheduler
  - **Consumer:** Background Worker

### Команды к Bot Service

- `sn:{env}:workers:queue:bot:commands`
  - **Назначение:** действия, требующие Discord REST API
  - **Producer:** Frontend/Admin API
  - **Consumer:** Bot Service Worker

### Синхронизация данных

- `sn:{env}:workers:queue:sync:guilds`
  - **Назначение:** периодическая синхронизация гильдий, ролей и участников
  - **Producer:** Scheduler
  - **Consumer:** Background Worker

### Импорт истории сообщений

- `sn:{env}:workers:queue:history:sync`
  - **Назначение:** импорт истории сообщений гильдии после первого контакта (GUILD_CREATE / регистрация в PostgreSQL).
  - **Producer:** воркер/процесс, выполняющий First Contact (guild setup), после успешного создания гильдии.
  - **Consumer:** Background Worker (History Sync Worker).
  - **Приоритет:** самый низкий среди очередей воркеров.

### Конфигурация логов событий

- `sn:{env}:workers-queue-logs-config` (имя очереди в BullMQ без двоеточий: `workers-queue-logs-config`)
  - **Назначение:** обновление кэша подписок на события при изменении настроек логирования (channel_id, enabled в guild_log_settings).
  - **Producer:** Frontend API (при PATCH настроек логов).
  - **Consumer:** Background Worker (воркеры обновляют кэш подписок на события).

### GDPR: удаление данных пользователя (Right to be Forgotten)

- `sn:{env}:workers-queue-gdpr-user-delete` (имя очереди в BullMQ без двоеточий: `workers-queue-gdpr-user-delete`)
  - **Назначение:** удаление/анонимизация всех записей пользователя в ClickHouse после полного удаления профиля из PostgreSQL (DELETE /api/users/me/data).
  - **Producer:** Frontend API (после успешного удаления пользователя).
  - **Consumer:** Ingestor Worker.
  - **Payload:** `{ discordUserId: string }` — Discord Snowflake ID пользователя; выполняется `ALTER TABLE raw_events DELETE WHERE discord_user_id = :discordUserId`.

> **Важно:** имена очередей в BullMQ должны совпадать в producer/consumer и быть одинаковыми во всех средах через префикс `sn:{env}`.

## 4.3.7 Redis Pub/Sub (Real-time guild state)

- `sn:{env}:frontend-api:channel:guild-state`
  - **Тип:** Pub/Sub channel
  - **Publisher:** Ingestor Worker, Bot Service (при изменении статуса импорта, счётчиков, участников, голоса, веток и т.д.).
  - **Subscriber:** Frontend API (пересылает события в WebSocket-комнаты по guildId).
  - **Payload (JSON):** `GuildStateEventPayload` — `guildId` (UUID), `discordGuildId` (Snowflake), `parameter`, `direction` (`set`|`inc`|`dec`), `delta?`, `value?`, `timestamp` (ISO 8601). Параметры: `historySyncStatus`, `memberCount`, `onlineMembers`, `totalMessages`, `threadCreated`, `lastActivity`, `bot_status`, `isBotInGuild`, `guildInfo`, `botConnected`, `lastSyncAt`, `voiceOnline`.
  - **Назначение:** доставка событий изменения состояния гильдий на фронтенд в реальном времени через WebSocket.
