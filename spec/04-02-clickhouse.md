# 4.2. ClickHouse (Analytical Layer)

> **Важное примечание:** Перед началом реализации необходимо детально изучить всю документацию в папке `ABOUT/` и её подпапках (`API_SPEC_ADMIN`, `API_SPEC_FRONT`), а также ознакомиться с уже описанными пунктами в папке `spec/` для полного понимания контекста и текущих архитектурных решений.

Документ описывает структуру аналитического слоя на ClickHouse, достаточную для реализации фронтенд‑и админ‑API, а также требований к аналитике и ML/BI‑витринам.

## 4.2.1 Таблица сырых событий `raw_events`

**Назначение:** единый поток событий из Discord, предназначенный для дальнейшей агрегации в materialized views.

**Источник записи:** только Ingestor Worker.  
**Чтение:** Frontend API и Admin API (read‑only).

**Движок:** `MergeTree`  
**Партиционирование:** `toStartOfWeek(event_time)` (неделя)  
**Сортировка (ORDER BY):** `(guild_id, event_date, event_type, user_id)`  
**Первичный ключ:** совпадает с ORDER BY

**Рекомендуемые поля:**
- `event_id` UUID — уникальный идентификатор события (для дедупликации при ретраях).
- `event_time` DateTime — точное время события (UTC).
- `event_date` Date — производное поле для удобства агрегаций.
- `event_type` LowCardinality(String) — тип события (например, `MESSAGE_CREATE`, `VOICE_STATE_UPDATE`, `COMMAND_EXECUTED`).
- `guild_id` UUID — внутренний ID гильдии (из PostgreSQL).
- `discord_guild_id` String — Discord Snowflake (для трассировки).
- `user_id` UUID — внутренний ID пользователя (если доступен).
- `discord_user_id` String — Discord Snowflake пользователя (если доступен).
- `anonymized_hash` Nullable(String) — хеш пользователя при включённом `anonymize_user_data` (иначе `NULL`).
- `channel_id` String — Discord Snowflake канала (если применимо).
- `role_id` String — Discord Snowflake роли (если применимо).
- `command_name` String — имя команды (если применимо).
- `plan_tier` LowCardinality(String) — `free|pro|enterprise`, фиксируется на момент события.
- `is_bot_generated` Boolean — отметка, что событие сгенерировано ботом.
- `payload` String — JSON‑строка с дополнительными полями, специфичными для события.
- `ingested_at` DateTime — время записи в ClickHouse.
- `retention_until` DateTime — дата, по которой применяется TTL (см. 4.2.3).
- `is_historical` UInt8 DEFAULT 0 — признак события, загруженного при History Ingestion; значение `1` только для событий импорта истории сообщений. В будущем при необходимости позволяет исключать исторические данные из отдельных отчётов (они могут быть менее точными, например нет точного времени редактирования старого сообщения).

> **Примечание по анонимизации:** Поскольку в pipeline уже используется Privacy‑First, любые чувствительные поля должны быть либо обрезаны, либо хешированы до записи в `raw_events`. При включённом `anonymize_user_data` идентификатор для агрегаций фиксируется в `anonymized_hash`.

## 4.2.2 Индексы и производительность

- Для ускорения выборок по гильдии и периоду ключ сортировки должен начинаться с `guild_id` и времени.
- При росте объема допускается добавление пропускающего индекса по `event_type` (например, `set`).
- Для колонок с небольшой кардинальностью (`event_type`, `plan_tier`) использовать `LowCardinality`.

## 4.2.3 Политика хранения (TTL)

Требование по хранению событий зависит от тарифа:

- **Free:** 90 дней.
- **Pro/Enterprise:** без TTL (данные сохраняются без автоматического удаления).

**Реализация в ClickHouse:**

- Поле `retention_until` выставляется Ingestor Worker'ом при записи:
  - `free`: `event_time + INTERVAL 90 DAY`
  - `pro/enterprise`: очень далёкая дата (например, `2100-01-01`)
- TTL на уровне таблицы:
  - `TTL retention_until`

Такой подход позволяет хранить данные по тарифам в одной таблице без физического разделения.

**Обновление при смене плана:**

При апгрейде подписки гильдии с Free на Pro/Enterprise необходимо продлить хранение уже записанных строк.

Пример SQL (выполняется при апгрейде плана в PostgreSQL):

```sql
ALTER TABLE raw_events
MODIFY COLUMN retention_until DateTime DEFAULT toDateTime('2100-01-01 00:00:00');
```

Для существующих строк конкретной гильдии дополнительно применяется UPDATE:

```sql
ALTER TABLE raw_events
UPDATE retention_until = toDateTime('2100-01-01 00:00:00')
WHERE guild_id = :guild_id
  AND retention_until < toDateTime('2100-01-01 00:00:00');
```

**Поведение при удалении гильдии:** ClickHouse не поддерживает каскадное удаление. При удалении гильдии в PostgreSQL соответствующие строки в `raw_events` и материализованных представлениях в ClickHouse не удаляются и остаются до срабатывания TTL (поле `retention_until`). Это нормальное поведение; требования к хранению по тарифам не меняются. **Требование к API:** при построении отчётов и выборок по гильдии необходимо проверять существование и статус гильдии в PostgreSQL (или кэше). Для удалённых или несуществующих `guild_id` отчёты не строить и возвращать 404 или пустой результат, чтобы не опираться на «сиротские» данные в ClickHouse как на активные.

## 4.2.4 Materialized Views (агрегации)

Materialized Views обязательны для быстрых ответов фронтенду и админке. Ниже приведены **обязательные** витрины.

### 1) `mv_daily_activity`

**Назначение:** дневная активность по гильдии (сообщения/участники/голос).

```sql
CREATE MATERIALIZED VIEW mv_daily_activity
ENGINE = AggregatingMergeTree
PARTITION BY toStartOfWeek(event_date)
ORDER BY (guild_id, event_date)
AS
SELECT
  guild_id,
  event_date,
  countIfState(event_type = 'MESSAGE_CREATE') AS messages_count,
  countIfState(event_type = 'GUILD_MEMBER_ADD') AS members_joined,
  sumState(if(event_type = 'VOICE_STATE_UPDATE', toUInt64(JSONExtractInt(payload, 'voiceMinutes')), 0)) AS voice_minutes,
  uniqCombinedState(user_id) AS unique_users_count
FROM raw_events
GROUP BY guild_id, event_date;
```

> **Примечание:** Для чтения из `mv_daily_activity` используйте `countIfMerge`, `sumMerge`, `uniqCombinedMerge`.

### 2) `mv_role_stats`

**Назначение:** распределение активности по ролям.

```sql
CREATE MATERIALIZED VIEW mv_role_stats
ENGINE = SummingMergeTree
PARTITION BY toStartOfWeek(event_date)
ORDER BY (guild_id, role_id, event_date)
AS
SELECT
  guild_id,
  role_id,
  event_date,
  count() AS events_count
FROM raw_events
WHERE role_id != ''
GROUP BY guild_id, role_id, event_date;
```

### 3) `mv_heatmap`

**Назначение:** тепловая карта активности (день недели + час).

```sql
CREATE MATERIALIZED VIEW mv_heatmap
ENGINE = SummingMergeTree
PARTITION BY toStartOfWeek(event_date)
ORDER BY (guild_id, day_of_week, hour)
AS
SELECT
  guild_id,
  toDayOfWeek(event_time) AS day_of_week,
  toHour(event_time) AS hour,
  count() AS events_count
FROM raw_events
WHERE event_type = 'MESSAGE_CREATE'
GROUP BY guild_id, day_of_week, hour;
```

### 4) `mv_command_stats`

**Назначение:** статистика использования команд (для аналитики в админке).

```sql
CREATE MATERIALIZED VIEW mv_command_stats
ENGINE = SummingMergeTree
PARTITION BY toStartOfWeek(event_date)
ORDER BY (guild_id, command_name, event_date)
AS
SELECT
  guild_id,
  command_name,
  event_date,
  count() AS execution_count,
  sumIf(1, JSONExtractBool(payload, 'isError') = 1) AS error_count
FROM raw_events
WHERE command_name != ''
GROUP BY guild_id, command_name, event_date;
```

### 5) `mv_top_members`

**Назначение:** поддержка Leaderboard (topMembers).

Техническое поле `event_date` используется для партиционирования.

```sql
CREATE MATERIALIZED VIEW mv_top_members
ENGINE = SummingMergeTree
PARTITION BY toStartOfWeek(event_date)
ORDER BY (guild_id, user_id)
AS
SELECT
  guild_id,
  user_id,
  event_date,
  sumIf(1, event_type = 'MESSAGE_CREATE') AS message_count,
  sumIf(toUInt64(JSONExtractInt(payload, 'voiceMinutes')), event_type = 'VOICE_STATE_UPDATE') AS voice_minutes
FROM raw_events
WHERE is_bot_generated = 0
GROUP BY guild_id, user_id, event_date;
```

> **Важно:** точные поля внутри `payload` должны соответствовать формату событий Bot Service и Ingestor Worker. При изменении формата событий необходимо синхронно обновлять MV.

## 4.2.5 Данные для Admin API / counters

Для ответа `GET /api/analytics/counters` требуется поле `popularTemplate`, а также список `topTemplates`. Эти данные не хранятся в ClickHouse.

- **Распределение по типам, totalActive, avgPerGuild:** допускается получать из витрин ClickHouse по событиям счётчиков или из агрегатов по `raw_events`.
- **popularTemplate / topTemplates:** источник — PostgreSQL, таблица `counters` (поле `template`, агрегация по строкам шаблонов).

Admin API при формировании ответа объединяет данные из ClickHouse (распределение и метрики) и PostgreSQL (шаблоны).

## 4.2.6 Раздельные адреса API (Frontend/Admin)

В документации и конфигурации проекта должно быть явно зафиксировано:

- **Frontend API** размещается на публичном адресе (например, `https://api.server.ninja`).
- **Admin API** размещается на внутреннем адресе и доступен только через VPN (например, `https://admin-api.internal.server.ninja`).
- Базовые URL для обоих API задаются через переменные окружения.
