# Диагностика: сообщение в Discord не появляется в WebSocket фронтенда

Документ фиксирует ключевые места кода цепочки real-time (Discord → Redis → WebSocket) и готовый текст для обращения к внешнему специалисту.

## 1. Ключевые места в коде

### 1.1 Публикация в Redis (bot-service)

- **Обработчик Discord MESSAGE_CREATE**  
  `apps/bot-service/src/shard/shard-event-handlers.ts`  
  - `onMessageCreate` (≈443–477): получает сообщение, вызывает `getGuildId(discordGuildId)`, при наличии гильдии в БД вызывает `touchGuildLastActivity(discordGuildId)`.
  - `touchGuildLastActivity` (≈281–296): обновляет `lastActivity` в БД, затем вызывает `publishGuildStateEvent(redis, redisPrefix, { guildId, discordGuildId, parameter: 'lastActivity', direction: 'set', value: ISO timestamp })`.

- **Формирование Redis-префикса в shard-worker**  
  `apps/bot-service/src/shard/shard-worker.ts`  
  - `envPrefix()` (≈23–32): по `NODE_ENV` возвращает `dev` / `prod` / `stage` / `test`.  
  - `prefix = 'sn:' + envPrefix() + ':'` (≈72), передаётся в `createShardEventHandlers({ redisPrefix: prefix })` (≈105).

- **Публикация события в канал**  
  `libs/shared/src/realtime/guild-state.publish.ts`  
  - `publishGuildStateEvent(redis, prefix, payload)`: канал = `prefix + GUILD_STATE_CHANNEL_SUFFIX`.  
  `libs/shared/src/realtime/guild-state.constants.ts`  
  - `GUILD_STATE_CHANNEL_SUFFIX = 'frontend-api:channel:guild-state'`.  
  Итоговый канал: `sn:{env}:frontend-api:channel:guild-state`.

### 1.2 Подписка на Redis (frontend-api)

- **Подписчик на канал guild-state**  
  `apps/frontend-api/src/realtime/guild-state-redis-subscriber.service.ts`  
  - `onModuleInit()` (≈18–42): создаётся `subscriber = redis.getClient().duplicate()`, канал = `this.sharedConfig.redis.prefix + GUILD_STATE_CHANNEL_SUFFIX` (≈21).  
  - Лог при старте: `Subscribing to Redis channel: ${channel}`, затем `Subscribed to Redis channel ${channel}`.  
  - Обработчик `message` (≈30–41): парсит JSON в `GuildStateEventPayload`, проверяет `guildId` и `parameter`, логирует `[realtime] Redis → gateway …`, вызывает `this.gateway.broadcastToGuild(payload.guildId, payload)`.

- **Префикс Redis в frontend-api**  
  Берётся из `SharedConfigService.redis.prefix`: `sn:{envShort}:`, где `envShort` по `NODE_ENV` (см. `libs/shared/src/config/shared-config.service.ts`, getter `redis`).

### 1.3 WebSocket: подключение и подписка на гильдии

- **Gateway**  
  `apps/frontend-api/src/realtime/guild-state.gateway.ts`  
  - Путь Socket.IO: `path: '/api/realtime'`, namespace: `'/guild-state'` (≈22–25).  
  - `handleConnection` (≈39–55): токен из `handshake.auth.token` или `handshake.query.token`; при невалидном/отсутствующем токене — disconnect.  
  - `@SubscribeMessage('subscribe')`: payload `{ guildIds?: (string | number)[] }`. Элементы приводятся к string (Snowflake как number теряет точность; при передаче number пишется предупреждение в лог). Для каждого ID вызывается `findGuildByIdOrDiscordId`; **в room добавляется, если пользователь владелец гильдии (`guild.ownerId === userId`) или guild-админ по Discord** (`userHasGuildAdmin(userId, guild.discordGuildId)`). При пропуске (гильдия не найдена или нет прав) — debug-лог. Room = `guild:${guild.id}` (внутренний UUID).  
  - `broadcastToGuild(guildId, event)`: `this.server.to('guild:' + guildId).emit('guild-state', event)`.
  - **Важно:** WebSocket Gateway должен зависеть только от singleton‑провайдеров. Если gateway инжектит request‑scoped сервис, он сам становится request‑scoped и инициализируется лениво, что ломает `afterInit` и ведёт к `broadcast queued (server not ready)`.

- **Поиск гильдии по ID**  
  `apps/frontend-api/src/guilds/guilds.service.ts`: `findGuildByIdOrDiscordId(id)` — принимает string или number (внутри приводится к string). Ищет по внутреннему UUID или по Discord Snowflake (`discordGuildId`). В debug логирует: запрошенный id, тип входа (inputType), тип (uuid/snowflake) и результат (found/not found).

Итог: клиент должен подключиться с JWT, отправить `subscribe` с массивом `guildIds` (**строками** — UUID или Snowflake; число для Snowflake небезопасно из-за Number.MAX_SAFE_INTEGER), и быть **владельцем или администратором гильдии** (ownerId в БД или права Manage Guild/Administrator в Discord), иначе в room не попадёт и события `guild-state` не получит.

---

## 2. Готовый текст обращения к внешнему специалисту

Ниже текст можно скопировать и отправить специалисту без доступа к репозиторию.

---

Нужна помощь с диагностикой real-time цепочки Discord→Redis→WebSocket.

**Симптом:** при отправке сообщения в Discord в гильдии в логах `bot-service` видно, что событие `MESSAGE_CREATE` обработано и выполняется публикация в Redis (лог: `[realtime] Discord → Redis … parameter=lastActivity`). Но на фронтенде (Socket.IO `/api/realtime`, namespace `/guild-state`) событие не приходит (клиент не получает `guild-state`).

**Архитектура:** `bot-service` (Discord shard-worker) публикует события состояния гильдии в Redis Pub/Sub канал `sn:{envShort}:frontend-api:channel:guild-state`, где `{envShort}` вычисляется из `NODE_ENV` (development→dev, production→prod, stage→stage, test→test). `frontend-api` подписывается на тот же канал и при получении JSON payload эмитит Socket.IO событие `guild-state` в room `guild:<internalGuildUuid>`.

**Важная деталь:** при `MESSAGE_CREATE` в Redis публикуется не «сообщение», а только событие состояния гильдии с `parameter=lastActivity`, `direction=set`, `value=<ISO timestamp>`. Если UI ожидает объект сообщения — такого события по текущей реализации нет, ожидаемый сигнал — именно `lastActivity`.

**Что видно по логам (пример):**
- `bot-service`: `[analytics] MESSAGE_CREATE guildId=<uuid> discordGuildId=<snowflake>`
- `bot-service`: `[realtime] Discord → Redis guildId=<uuid> parameter=lastActivity`

**Просьба:** помочь найти причину, по которой publish выполняется, но `frontend-api` и/или WebSocket клиент не получают событие.

**Гипотезы для проверки:**
1. **Конфликт NODE_ENV** — `NODE_ENV` в `bot-service` и `frontend-api` различается ⇒ разные префиксы (`sn:dev:` / `sn:prod:`) ⇒ publish и subscribe в разные каналы. Унифицировать NODE_ENV в docker-compose/.env для обоих сервисов.
2. **Разные инстансы Redis** — сервисы смотрят на разные `REDIS_HOST`/`REDIS_PORT` (например, один на localhost, другой на контейнер `redis`). Сверить переменные окружения.
3. WebSocket клиент не попадает в нужную room: не отправляет `subscribe`, передаёт `guildIds` числами (snowflake должен быть string), либо пользователь не владелец и не администратор гильдии (в room добавляются только owner или пользователи с правами Manage Guild/Administrator в Discord).

**Проверка на Redis:**
- В момент отправки сообщения в Discord посмотреть `MONITOR` и убедиться в `PUBLISH` в канал `sn:dev:frontend-api:channel:guild-state` (или другой env).
- Проверить наличие подписчиков: `PUBSUB NUMSUB sn:dev:frontend-api:channel:guild-state`.

При необходимости могу предоставить фрагменты логов docker-compose и переменные окружения обоих контейнеров.

---

## 3. Минимальные проверки (без доступа к исходникам)

### 3.1 Окружение (унификация NODE_ENV и Redis)

- **NODE_ENV:** в `docker-compose.yml` (или .env) у `bot-service` и `frontend-api` должна быть одна и та же величина (`development`, `production`, `stage`, `test`). Иначе каналы Redis будут разными (`sn:dev:...` vs `sn:prod:...`) и события не дойдут.
- **REDIS_HOST и REDIS_PORT:** у обоих сервисов должны совпадать (один и тот же инстанс Redis). При запуске в Docker оба обычно используют сервис `redis` и порт 6379.
- Быстрая проверка: в Redis выполнить `PUBSUB CHANNELS "sn:*"`. Если видны и `sn:dev:...`, и `sn:prod:...` — у сервисов разное окружение.

### 3.2 Redis

- **Единый префикс (NODE_ENV):** выполнить `PUBSUB CHANNELS "sn:*"`. Должна быть одна ветка префиксов (только `sn:dev:...` или только `sn:prod:...`). Если видны и `sn:dev:...`, и `sn:prod:...` — сервисы в разном окружении.
- **Проверка активности публикации:** в redis-cli выполнить `PSUBSCRIBE *`, затем отправить сообщение в Discord. Должны появиться сообщения о PUBLISH. Если консоль пуста — проблема в bot-service или конфигах (REDIS_HOST).
- Альтернатива: запустить `redis-cli MONITOR`, отправить сообщение в Discord — должен появиться `PUBLISH` в канал вида `sn:dev:frontend-api:channel:guild-state`. Если пусто — проблема в bot-service или REDIS_HOST.
- **Проверка наличия подписчика (Frontend-API):** выполнить `PUBSUB NUMSUB sn:dev:frontend-api:channel:guild-state` (заменить `dev` на свой NODE_ENV). Должно вернуть ≥ 1. Если 0 — Frontend-API не подписан или использует другой префикс.

### 3.3 Логи frontend-api

- При старте: сообщения вида «Subscribing to Redis channel: sn:…» и «Subscribed to Redis channel …».
- При срабатывании события: «[realtime] Redis message received …» и «[realtime] Redis → gateway …», затем «[realtime] broadcast → clients …».

### 3.4 WebSocket клиент

- Подключение: тот же хост, что REST API; path `/api/realtime`, namespace `/guild-state`.
- Авторизация: JWT в `handshake.auth.token` или `handshake.query.token`.
- После подключения: отправить событие `subscribe` с payload `{ guildIds: ["<uuid или discord snowflake строкой>"] }` (массив **строк**, не чисел).
- Проверка прав: в room попадают владелец гильдии (ownerId в БД) или пользователь с правами администратора гильдии в Discord (Manage Guild / Administrator). SQL: `SELECT id, "ownerId" FROM guilds WHERE "discordGuildId" = 'ID_ВАШЕЙ_ГИЛЬДИИ';` — сравнить `ownerId` с `sub` из JWT. Если не совпадает — пользователь должен иметь права админа гильдии в Discord (OAuth scope guilds).
- Убедиться, что клиент в комнате: в логах frontend-api после subscribe — «Realtime subscribe: userId=… joined … room(s): guild:…». Либо включить дебаг Socket.IO: `DEBUG=socket.io:* npm run start` (или аналог для frontend-api) и проверить `socket.rooms` на клиенте — должна быть комната `guild:<uuid>`.
- Слушать событие `guild-state`; при MESSAGE_CREATE приходит payload с `parameter: 'lastActivity'`, а не объект сообщения.

### 3.5 Пошаговая проверка (сводка)

| Шаг | Действие | Ожидаемый результат |
|-----|----------|--------------------|
| 1 | Запустить `redis-cli MONITOR` | При сообщении в Discord виден `PUBLISH ... lastActivity`. |
| 2 | Выполнить `PUBSUB NUMSUB <channel>` | Возвращает ≥ 1 (frontend-api слушает). |
| 3 | Проверить логи frontend-api | Появляется строка `[realtime] Redis → gateway`. |
| 4 | Проверить `socket.rooms` на клиенте / логи subscribe | Клиент в комнате `guild:<uuid>`. |

**Критично:** Событие MESSAGE_CREATE не передаёт на фронт содержимое сообщения. Обновляется только `lastActivity`. Если фронт ожидает текст сообщения — по этому каналу он его не получит.

---

## 4. Отладка доставки: скрипт и логи

### 4.1 Скрипт auth-and-socket

Скрипт подключается к WebSocket с JWT, шлёт `subscribe` и выводит в консоль каждое событие `guild-state`. Удобно для проверки цепочки без фронтенда.

```bash
# frontend-api должен быть запущен (порт по умолчанию 3001 или FRONTEND_API_URL)
npm run auth-and-socket
```

Скрипт сам регистрирует/логинит тестового пользователя и подписывается на гильдии из `GET /api/me/guilds`. Чтобы дополнительно подписаться на гильдию по Discord Snowflake (например, для сервера в URL):

```bash
SUBSCRIBE_GUILD_IDS=1392546208903335996 npm run auth-and-socket
```

После `connect` и `subscribe` отправьте сообщение в Discord в этой гильдии — в консоли должно появиться `guild-state #1` с `parameter: lastActivity`. Если не появляется — смотреть логи frontend-api (см. ниже).

### 4.2 Логи frontend-api при broadcast

При отправке в комнату в логах пишется число клиентов в комнате:

- `[realtime] broadcast → clients guildId=... parameter=lastActivity room=guild:... clientsInRoom=N`

Если **N = 0** — в комнате никого нет: клиент не подключился, не вызвал `subscribe` или не прошёл проверку прав (владелец/админ гильдии). Если **N ≥ 1** — событие ушло в комнату; при проблеме на фронте проверять приём события `guild-state` на клиенте.

### 4.3 Очередь и порядок инициализации

События из Redis могут прийти до первого подключения WebSocket-клиента. Такие события попадают в очередь и разбираются после инициализации namespace (при первом подключении), с небольшой задержкой (`setImmediate`), чтобы клиент успел отправить `subscribe` и попасть в комнаты. В логах:

- `[realtime] broadcast queued (server not ready)` — событие в очереди;
- после подключения клиента: `[realtime] Gateway initialized`, затем строки `broadcast → clients ... clientsInRoom=...` для разобранной очереди и последующих событий.
