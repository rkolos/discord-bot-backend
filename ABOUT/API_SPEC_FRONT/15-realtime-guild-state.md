# Real-time: события состояния гильдий (WebSocket)

Фронтенд может подключаться по WebSocket и получать в реальном времени события изменения состояния гильдий (импорт, счётчики, участники, голос, ветки обсуждений и т.д.).

## Подключение

- **Протокол:** Socket.IO.
- **Авторизация:** при подключении передать JWT в `auth.token`. Тот же access token, что возвращают `POST /api/auth/login`, `POST /api/auth/register`, Discord callback или `POST /api/auth/refresh`. При невалидном или отсутствующем токене сервер не устанавливает соединение — клиент получает событие `connect_error`, а не `connect` + `disconnect`.

### Точные параметры клиента (socket.io-client)

Базовый URL — тот же хост и порт, что и REST API (например `http://localhost:3001`). Namespace задаётся в первом аргументе как путь после хоста. Путь движка Socket.IO — отдельная опция `path`.

**Обязательно:**

| Параметр | Значение | Описание |
|----------|----------|----------|
| Первый аргумент `io()` | `"<baseUrl>/guild-state"` | Базовый URL API + namespace. Пример: `"http://localhost:3001/guild-state"`. |
| `path` | `"/api/realtime"` | Путь, на котором висит Socket.IO (без namespace). |
| `auth.token` | JWT access token (строка) | Токен из ответа логина/регистрации/refresh. |

**Пример для локальной разработки (frontend на 3010, API на 3001):**

```javascript
import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:3001'; // тот же хост, что и REST API
const accessToken = getStoredToken();     // из ответа login/register/refresh

const socket = io(`${API_BASE}/guild-state`, {
  path: '/api/realtime',
  auth: { token: accessToken },
});
```

**Неверно:** подставлять namespace в `path` (например `path: '/api/realtime/guild-state'`) или указывать только base URL без `/guild-state` в первом аргументе — тогда клиент подключится к default namespace, а не к `/guild-state`.

### CORS

Проверки CORS для WebSocket и первичного запроса Socket.IO выполняются **на бэкенде**. Убедитесь, что origin фронтенда разрешён:

- В `.env` или окружении frontend-api задано одно из: `CORS_ORIGIN` или `FRONTEND_BASE_URL`.
- Значение — точный origin фронта, например `http://localhost:3010` (без слэша в конце). Несколько origin через запятую: `http://localhost:3010,https://app.example.com`.
- По умолчанию в коде используется `http://localhost:3010`, если переменные не заданы.

Если фронт с другого origin и переменная не задана или не совпадает — соединение может блокироваться. Менять нужно конфиг/переменные окружения бэкенда, не фронта.

### Ответ 400 «Session ID unknown»

Если запрос к `/api/realtime/` возвращает 400 с телом `{"code":1,"message":"Session ID unknown"}` — сервер не знает переданный `sid` (сессия сброшена после перезапуска сервера или истекла). Клиенту нужно **полностью переподключиться**: закрыть сокет и создать новое соединение через `io(...)`, не повторять запросы со старым sid. Обычно Socket.IO-клиент при такой ошибке сам инициирует переподключение; при отключённом reconnection или своих retry нужно обрабатывать этот случай и делать новый connect.

## Подписка на гильдии

После успешного подключения клиент отправляет событие **`subscribe`** с payload:

```json
{ "guildIds": ["<discordGuildId1>", "<guildId-uuid2>", ...] }
```

- `guildIds` — массив ID гильдий: Discord Snowflake (строка) или внутренний UUID. Сервер проверяет, что текущий пользователь — владелец гильдии; только для таких гильдий сокет добавляется в комнату. События по гильдии приходят только подписанным клиентам.

## REST: инициализация полного состояния в сокете

Чтобы получить текущие значения всех параметров guild-state в том же формате, что и при стриме (для инициализации UI после подключения или для отладки приёма сообщений), фронтенд может вызвать REST-метод:

**Endpoint:** `POST /api/guilds/:guildId/realtime/emit-full-state`

- **Авторизация:** Bearer JWT + права администратора гильдии (как у остальных эндпоинтов гильдии).
- **Параметр пути:** `guildId` — внутренний UUID гильдии или Discord Snowflake.
- **Ответ:** `200 OK`, тело `{ "data": { "emitted": <number> } }` — количество отправленных событий `guild-state`.

Сервер собирает текущие значения из БД и аналитики и отправляет их в комнату `guild:${guildId}` через тот же механизм, что и real-time обновления. Все подключённые клиенты, подписанные на эту гильдию (включая вызвавшего), получают события **`guild-state`** в том же формате (parameter, direction, value, timestamp). Рекомендуемый порядок: подключиться к сокету, отправить `subscribe` с `guildIds`, затем вызвать `POST .../emit-full-state` для нужной гильдии.

## Входящие события: полный перечень

По одному сокету (после `subscribe` с `guildIds`) фронт может получить **два имени событий**:

1. **`guild-state`** — нормализованные обновления (parameter, direction, value, timestamp). Параметры: `lastActivity`, `memberCount`, `voiceOnline`, `threadCreated`, `historySyncStatus`, `totalMessages`, `bot_status`, `isBotInGuild`, `botConnected`, `guildInfo`, `lastSyncAt`, `onlineMembers`.
2. **`discord-event`** — сырые события Discord (eventType, data, timestamp). Типы: **MESSAGE_CREATE**, **MESSAGE_UPDATE**, **MESSAGE_DELETE**, **GUILD_MEMBER_ADD**, **GUILD_MEMBER_REMOVE**, **GUILD_MEMBER_UPDATE**, **VOICE_STATE_UPDATE**, **PRESENCE_UPDATE**, **THREAD_CREATE**, **GUILD_CREATE**, **GUILD_DELETE**.

Подробное описание payload по каждому событию и типу — в [docs/frontend-realtime-messages.md](../../docs/frontend-realtime-messages.md) (от корня репозитория: `docs/frontend-realtime-messages.md`).

---

## Событие `guild-state`: формат payload

Сервер отправляет событие **`guild-state`** с payload в формате. Во всех событиях поле **`value`** содержит полное новое значение параметра; для отображения на фронте достаточно использовать `value`, накопление по `delta` не обязательно.

| Поле | Тип | Описание |
|------|-----|----------|
| guildId | string | Внутренний UUID гильдии |
| discordGuildId | string | Discord Snowflake гильдии |
| parameter | string | Имя параметра (см. список ниже) |
| direction | string | `set` \| `inc` \| `dec` |
| delta | number? | На сколько изменилось (для inc/dec) |
| value | string \| number \| boolean \| object? | Новое значение |
| timestamp | string | ISO 8601 время события |

## Параметры (parameter)

| parameter | direction | value / delta | Описание |
|-----------|-----------|---------------|----------|
| historySyncStatus | set | PROCESSING / COMPLETED / FAILED | Импорт начат / завершён / ошибка |
| memberCount | set | число | Текущее число участников |
| onlineMembers | set | число | Онлайн (из синхронизации с Discord) |
| totalMessages | set | число | Полное количество сообщений по гильдии (после импорта истории) |
| threadCreated | set \| dec | set: { threadId, channelId, name? }; dec: delta 1 при удалении ветки | Создана или удалена ветка обсуждений |
| lastActivity | set | ISO timestamp | Последняя активность |
| bot_status | set | installed / not_installed | Статус бота: установлен и получает данные / удалён или не подключён |
| isBotInGuild | set | true / false | Бот в гильдии / вышел |
| guildInfo | set | { name?, iconUrl?, banner? } | Имя, иконка, баннер (при sync и при guildUpdate) |
| botConnected | set | true / false | Кастомный бот подключён / отключён (false также при disconnect, invalidated, shutdown) |
| lastSyncAt | set | ISO timestamp | Время последней синхронизации с Discord |
| voiceOnline | set | число | Участников в голосовых каналах |

## Примеры payload

- Импорт начат: `{ parameter: "historySyncStatus", direction: "set", value: "PROCESSING" }`
- Импорт завершён: `{ parameter: "historySyncStatus", direction: "set", value: "COMPLETED" }`
- Новый участник: `{ parameter: "memberCount", direction: "set", value: 123 }`
- Онлайн: `{ parameter: "onlineMembers", direction: "set", value: 45 }`
- Сообщения: `{ parameter: "totalMessages", direction: "set", value: 12500 }`
- Новая ветка: `{ parameter: "threadCreated", direction: "set", value: { threadId, channelId, name } }`. Удалена ветка: `{ parameter: "threadCreated", direction: "dec", delta: 1 }`
- Последняя активность: `{ parameter: "lastActivity", direction: "set", value: "2025-02-03T12:00:00.000Z" }`
- Бот установлен: `{ parameter: "bot_status", direction: "set", value: "installed" }`. Бот вышел: `{ parameter: "bot_status", direction: "set", value: "not_installed" }`, `{ parameter: "isBotInGuild", direction: "set", value: false }`
- Голос: `{ parameter: "voiceOnline", direction: "set", value: 7 }`

Фронтенд может обновлять UI по этим событиям без повторного опроса REST API.

---

## Событие `discord-event`: полные данные от Discord

Помимо нормализованного **`guild-state`**, сервер отправляет событие **`discord-event`** с полным телом события Discord для подписанной гильдии. Подписка на гильдии та же (`subscribe` с `guildIds`); отдельно подписываться не нужно.

### Формат payload

| Поле | Тип | Описание |
|------|-----|----------|
| guildId | string | Внутренний UUID гильдии |
| discordGuildId | string | Discord Snowflake гильдии |
| eventType | string | Тип события в стиле Discord Gateway (см. список ниже) |
| data | object | Тело события: структура совместима с Discord API для данного типа |
| timestamp | string? | ISO 8601 время события |

### Поддерживаемые eventType

- **MESSAGE_CREATE** — новое сообщение; `data` — объект сообщения (Discord API).
- **MESSAGE_UPDATE** — редактирование сообщения; `data`: `{ old, new }` (объекты сообщения).
- **MESSAGE_DELETE** — удаление сообщения; `data` — объект/частичное сообщение.
- **GUILD_MEMBER_ADD** — участник присоединился; `data` — объект участника.
- **GUILD_MEMBER_REMOVE** — участник вышел; `data` — объект участника.
- **GUILD_MEMBER_UPDATE** — обновление участника (роли и т.д.); `data`: `{ old, new }`.
- **VOICE_STATE_UPDATE** — вход/выход из голосового канала; `data`: `{ old, new }`.
- **PRESENCE_UPDATE** — смена статуса (online/idle/dnd/offline); `data`: `{ old, new }`.
- **THREAD_CREATE** — создана ветка обсуждений; `data` — объект ветки.
- **GUILD_CREATE** — бот добавлен в гильдию; `data` — объект гильдии.
- **GUILD_DELETE** — бот удалён из гильдии; `data` — объект/частичная гильдия.

Поле `data` повторяет структуру данных Discord API для соответствующего типа события. Для событий с двумя аргументами (update) в `data` передаются поля `old` и `new`.
