# Сообщения WebSocket для фронтенда

После подключения к namespace `/guild-state` и отправки `subscribe` с `guildIds` фронтенд получает **два вида** событий по одному и тому же сокету:

1. **`guild-state`** — нормализованные обновления состояния (счётчики, статусы, импорт и т.д.).
2. **`discord-event`** — «сырые» события Discord с полным телом (сообщения, участники, голос, ветки и т.д.).

Для инициализации интерфейса текущими значениями (сразу после подключения и `subscribe`) или для отладки приёма сообщений можно вызвать REST-метод **`POST /api/guilds/:guildId/realtime/emit-full-state`**. Бэкенд отправит в сокет все текущие события `guild-state` в том же формате; описание — в [15-realtime-guild-state.md](../ABOUT/API_SPEC_FRONT/15-realtime-guild-state.md).

---

## Полный перечень событий сокета

Все события, которые фронт может получить по одному сокету после `subscribe` с `guildIds`:

| Имя события (Socket.IO) | Описание |
|-------------------------|----------|
| **`guild-state`** | Нормализованное обновление: в payload — `parameter`, `direction`, `value`, `delta?`, `timestamp`. Возможные `parameter`: `lastActivity`, `memberCount`, `voiceOnline`, `threadCreated`, `historySyncStatus`, `totalMessages`, `bot_status`, `isBotInGuild`, `botConnected`, `guildInfo`, `lastSyncAt`, `onlineMembers`. |
| **`discord-event`** | Сырое событие Discord: в payload — `eventType`, `data`, `timestamp`. Возможные `eventType`: **MESSAGE_CREATE**, **MESSAGE_UPDATE**, **MESSAGE_DELETE**, **GUILD_MEMBER_ADD**, **GUILD_MEMBER_REMOVE**, **GUILD_MEMBER_UPDATE**, **VOICE_STATE_UPDATE**, **PRESENCE_UPDATE**, **THREAD_CREATE**, **GUILD_CREATE**, **GUILD_DELETE**. |

Детальное описание payload по каждому событию — в разделах «1. Событие guild-state», «2. Событие discord-event» и «Справочник полей» ниже.

---

## Формат данных в событиях

**`guild-state`** — в payload всегда есть `guildId`, `discordGuildId`, `parameter`, `direction`, `value` (или `delta` при inc/dec), `timestamp`. Список `parameter` и примеры — в разделе «1. Событие guild-state».

**`discord-event`** — в payload всегда есть `guildId`, `discordGuildId`, `eventType`, `data`, `timestamp`. Бэкенд дополняет `data` полями из Discord (автор, текст, канал и т.д.). Структура `data` зависит от `eventType`:

| eventType | Структура `data` | Ключевые поля |
|-----------|------------------|---------------|
| MESSAGE_CREATE | Объект сообщения | `id`, `channelId`, `content`, `cleanContent`, `authorId`, `author` (id, username?, tag?, discriminator?, avatar?), `createdTimestamp`, `editedTimestamp`, эмбеды/вложения |
| MESSAGE_UPDATE | `{ old, new }` — два объекта сообщения | В каждом те же поля, что в MESSAGE_CREATE |
| MESSAGE_DELETE | Объект сообщения (частичный) | `id`, `channelId` / `channel_id`, при наличии `content`, `author` |
| GUILD_MEMBER_ADD | Объект участника | `user` (id, username, tag, discriminator, avatar), `roles`, `joined_at` / `joinedAt` |
| GUILD_MEMBER_REMOVE | Объект участника | `user`, `guild_id` / `guildId` |
| GUILD_MEMBER_UPDATE | `{ old, new }` — два объекта участника | В каждом `user`, `roles`, `joined_at` и др. |
| VOICE_STATE_UPDATE | `{ old, new }` — два объекта голосового состояния | `channel_id` / `channelId`, `user_id` / `userId`, `channel` (id, name), `member.user` при обогащении |
| PRESENCE_UPDATE | `{ old, new }` — два объекта присутствия | `userId`, `guild`, `status`, `activities`, `clientStatus`, `user` при обогащении |
| THREAD_CREATE | Объект ветки | `id`, `name`, `parentId`, `guildId`, `type`, `ownerId`, `createdTimestamp` и др. |
| GUILD_CREATE | Объект гильдии | `id`, `name`, `icon`, `owner_id` / `ownerId`, `member_count` / `memberCount` |
| GUILD_DELETE | Объект гильдии (частичный) | `id`, `name`, `unavailable`? |

Поля могут приходить в camelCase или snake_case. Для отображения сообщений используйте `data.content` и `data.author`; для участников — `user.username`, `user.tag`; для голоса — `channel_id` и `channel`, для статуса — `status` и `user`. Текст сообщений (`content`) не пустой только при включённом у бота привилегированном интенте **Message Content Intent** в Discord Developer Portal и в коде.

Ниже — примеры payload по каждому типу и справочник полей.

---

## 1. Событие `guild-state`

Имя события Socket.IO: **`guild-state`**.

Во всех событиях guild-state поле **`value`** содержит полное новое значение параметра (для отображения на фронте достаточно использовать `value`; накопление по `delta` не обязательно).

Общая структура payload:

```ts
{
  guildId: string;        // UUID гильдии в нашей БД
  discordGuildId: string; // Snowflake гильдии в Discord
  parameter: string;      // какой параметр обновился
  direction: 'set' | 'inc' | 'dec';
  delta?: number;        // только для inc/dec
  value?: string | number | boolean | object;
  timestamp: string;     // ISO 8601
}
```

### Примеры по каждому `parameter`

**lastActivity** — в гильдии была активность (например, новое сообщение):

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "parameter": "lastActivity",
  "direction": "set",
  "value": "2026-02-06T14:33:42.672Z",
  "timestamp": "2026-02-06T14:33:42.672Z"
}
```

**memberCount** — изменилось число участников:

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "parameter": "memberCount",
  "direction": "set",
  "value": 124,
  "timestamp": "2026-02-06T14:35:00.000Z"
}
```

**voiceOnline** — число участников в голосовых каналах:

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "parameter": "voiceOnline",
  "direction": "set",
  "value": 7,
  "timestamp": "2026-02-06T14:36:00.000Z"
}
```

**threadCreated** — создана ветка обсуждений (`direction: "set"`, `value`: объект с `threadId`, `channelId`, `name`) или удалена ветка (`direction: "dec"`, `delta: 1`).

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "parameter": "threadCreated",
  "direction": "set",
  "value": {
    "threadId": "1392600000000000001",
    "channelId": "1392590000000000002",
    "name": "обсуждение-тема"
  },
  "timestamp": "2026-02-06T14:37:00.000Z"
}
```

**historySyncStatus** — импорт истории (начат / завершён / ошибка):

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "parameter": "historySyncStatus",
  "direction": "set",
  "value": "COMPLETED",
  "timestamp": "2026-02-06T14:40:00.000Z"
}
```

**totalMessages** — полное количество сообщений по гильдии (после импорта истории, direction: set):

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "parameter": "totalMessages",
  "direction": "set",
  "value": 12500,
  "timestamp": "2026-02-06T14:41:00.000Z"
}
```

**bot_status** — статус бота на сервере: установлен и получает данные (`installed`) или не установлен/удалён (`not_installed`):

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "parameter": "bot_status",
  "direction": "set",
  "value": "installed",
  "timestamp": "2026-02-06T14:42:00.000Z"
}
```

При удалении бота с сервера приходит `"value": "not_installed"`.

**isBotInGuild** — бот в гильдии или вышел:

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "parameter": "isBotInGuild",
  "direction": "set",
  "value": false,
  "timestamp": "2026-02-06T14:42:00.000Z"
}
```

**botConnected** — кастомный бот подключён или отключён. `true` — при подключении (GUILD_CREATE, onGuildCreate, onReady для кастомного токена). `false` — при удалении бота из гильдии (GUILD_DELETE / onGuildDelete), при отключении клиента (disconnect, invalidated) или при остановке сервиса (onModuleDestroy).

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "parameter": "botConnected",
  "direction": "set",
  "value": true,
  "timestamp": "2026-02-06T14:43:00.000Z"
}
```

**guildInfo** — имя, иконка, баннер. Отправляется при синхронизации гильдии (syncGuild) и при изменении любого из этих полей в Discord (событие guildUpdate).

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "parameter": "guildInfo",
  "direction": "set",
  "value": {
    "name": "Мой сервер",
    "iconUrl": "https://cdn.discordapp.com/icons/1392546208903335996/abc.png",
    "banner": "https://cdn.discordapp.com/banners/1392546208903335996/def.png"
  },
  "timestamp": "2026-02-06T14:44:00.000Z"
}
```

**lastSyncAt** — время последней синхронизации с Discord:

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "parameter": "lastSyncAt",
  "direction": "set",
  "value": "2026-02-06T14:45:00.000Z",
  "timestamp": "2026-02-06T14:45:00.000Z"
}
```

**onlineMembers** — число онлайн (из синхронизации):

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "parameter": "onlineMembers",
  "direction": "set",
  "value": 45,
  "timestamp": "2026-02-06T14:46:00.000Z"
}
```

---

## 2. Событие `discord-event`

Имя события Socket.IO: **`discord-event`**.

Payload: `guildId`, `discordGuildId`, `eventType`, `data` (тело события; при update-событиях — `{ old, new }`), `timestamp`. Поля в `data` — в формате discord.js (camelCase), возможен snake_case. Полный перечень полей — в разделе **«Справочник полей»** ниже. Структура payload:

```ts
{
  guildId: string;
  discordGuildId: string;
  eventType: string;   // MESSAGE_CREATE, GUILD_MEMBER_ADD, ...
  data: object;       // тело события (и при необходимости { old, new })
  timestamp?: string;
}
```

### Примеры по каждому `eventType`

**MESSAGE_CREATE** — новое сообщение. В `data` — объект сообщения (`content`, `author`, `authorId`, `channelId`, метаданные).

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "eventType": "MESSAGE_CREATE",
  "data": {
    "channelId": "1410302970121424937",
    "guildId": "1392546208903335996",
    "id": "1469374506823974912",
    "createdTimestamp": 1770396582085,
    "type": 0,
    "system": false,
    "content": "Текст сообщения",
    "authorId": "1020631621772255252",
    "author": {
      "id": "1020631621772255252",
      "username": "username",
      "tag": "username#0",
      "discriminator": "0",
      "avatar": "abc123"
    },
    "pinned": false,
    "tts": false,
    "embeds": [],
    "components": [],
    "attachments": [],
    "stickers": [],
    "position": 0,
    "editedTimestamp": null,
    "mentions": { "everyone": false, "users": [], "roles": [] },
    "flags": 0,
    "reference": null,
    "cleanContent": "Текст сообщения"
  },
  "timestamp": "2026-02-06T16:49:48.993Z"
}
```

**MESSAGE_UPDATE** — сообщение отредактировано. В `data` — `old` и `new` (объекты сообщения, структура как в MESSAGE_CREATE):

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "eventType": "MESSAGE_UPDATE",
  "data": {
    "old": {
      "channelId": "1410302970121424937",
      "guildId": "1392546208903335996",
      "id": "1469374506823974912",
      "createdTimestamp": 1770396582085,
      "content": "Было",
      "authorId": "1020631621772255252",
      "author": { "id": "1020631621772255252", "username": "user", "tag": "user#0" },
      "editedTimestamp": null
    },
    "new": {
      "channelId": "1410302970121424937",
      "guildId": "1392546208903335996",
      "id": "1469374506823974912",
      "createdTimestamp": 1770396582085,
      "content": "Стало",
      "authorId": "1020631621772255252",
      "author": { "id": "1020631621772255252", "username": "user", "tag": "user#0" },
      "editedTimestamp": 1770396592859
    }
  },
  "timestamp": "2026-02-06T16:49:59.809Z"
}
```

**MESSAGE_DELETE** — сообщение удалено:

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "eventType": "MESSAGE_DELETE",
  "data": {
    "id": "1392700000000000001",
    "channel_id": "1392590000000000002"
  },
  "timestamp": "2026-02-06T14:35:00.000Z"
}
```

**GUILD_MEMBER_ADD** — новый участник на сервере:

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "eventType": "GUILD_MEMBER_ADD",
  "data": {
    "user": {
      "id": "1392500000000000004",
      "username": "newuser",
      "discriminator": "0",
      "avatar": null
    },
    "nick": null,
    "roles": ["1392550000000000005"],
    "joined_at": "2026-02-06T14:36:00.000Z",
    "guild_id": "1392546208903335996"
  },
  "timestamp": "2026-02-06T14:36:00.000Z"
}
```

**GUILD_MEMBER_REMOVE** — участник вышел:

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "eventType": "GUILD_MEMBER_REMOVE",
  "data": {
    "user": {
      "id": "1392500000000000004",
      "username": "newuser",
      "discriminator": "0"
    },
    "guild_id": "1392546208903335996"
  },
  "timestamp": "2026-02-06T14:37:00.000Z"
}
```

**GUILD_MEMBER_UPDATE** — у участника изменились роли и т.д.; в `data` — `old` и `new`:

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "eventType": "GUILD_MEMBER_UPDATE",
  "data": {
    "old": {
      "user": { "id": "1392500000000000004" },
      "roles": ["1392550000000000005"]
    },
    "new": {
      "user": { "id": "1392500000000000004" },
      "roles": ["1392550000000000005", "1392550000000000006"]
    }
  },
  "timestamp": "2026-02-06T14:38:00.000Z"
}
```

**VOICE_STATE_UPDATE** — участник зашёл в голосовой канал или вышел; в `data` — `old` и `new`:

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "eventType": "VOICE_STATE_UPDATE",
  "data": {
    "old": {
      "channel_id": null,
      "user_id": "1392500000000000004"
    },
    "new": {
      "channel_id": "1392590000000000010",
      "channel": { "id": "1392590000000000010", "name": "Общий" },
      "user_id": "1392500000000000004"
    }
  },
  "timestamp": "2026-02-06T14:39:00.000Z"
}
```

**PRESENCE_UPDATE** — смена статуса; в `data` — `old` и `new` с полями `userId`, `guild`, `status`, `activities`, `clientStatus`:

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "eventType": "PRESENCE_UPDATE",
  "data": {
    "old": {
      "userId": "1400069019112968272",
      "guild": "1392546208903335996",
      "status": "idle",
      "activities": [],
      "clientStatus": { "web": "idle" }
    },
    "new": {
      "userId": "1400069019112968272",
      "guild": "1392546208903335996",
      "status": "offline",
      "activities": [],
      "clientStatus": {}
    }
  },
  "timestamp": "2026-02-06T16:49:40.809Z"
}
```

**THREAD_CREATE** — создана ветка обсуждений; в `data` — объект ветки (id, name, parentId, guildId, type: 11, ownerId, archived, createdTimestamp и др.):

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "eventType": "THREAD_CREATE",
  "data": {
    "type": 11,
    "guildId": "1392546208903335996",
    "guild": "1392546208903335996",
    "ownerId": "1020631621772255252",
    "id": "1469375052037492876",
    "name": "Thread",
    "parentId": "1469374856658161798",
    "locked": false,
    "archived": false,
    "autoArchiveDuration": 4320,
    "archiveTimestamp": 1770396757271,
    "lastMessageId": null,
    "messageCount": 0,
    "memberCount": 1,
    "totalMessageSent": 0,
    "appliedTags": [],
    "createdTimestamp": 1770396757271
  },
  "timestamp": "2026-02-06T16:52:44.186Z"
}
```

**GUILD_CREATE** — бот добавлен в гильдию:

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "eventType": "GUILD_CREATE",
  "data": {
    "id": "1392546208903335996",
    "name": "Мой сервер",
    "icon": "abc123",
    "owner_id": "1392500000000000001",
    "member_count": 100
  },
  "timestamp": "2026-02-06T14:42:00.000Z"
}
```

**GUILD_DELETE** — бот удалён из гильдии:

```json
{
  "guildId": "3aec30ea-5230-434a-90ec-0cfed276b742",
  "discordGuildId": "1392546208903335996",
  "eventType": "GUILD_DELETE",
  "data": {
    "id": "1392546208903335996",
    "name": "Мой сервер",
    "unavailable": true
  },
  "timestamp": "2026-02-06T14:43:00.000Z"
}
```

---

## Как слушать на клиенте

```javascript
socket.on('guild-state', (payload) => {
  console.log('guild-state', payload.parameter, payload.value);
  // обновить UI по payload.parameter и payload.value
});

socket.on('discord-event', (payload) => {
  console.log('discord-event', payload.eventType, payload.data);
  // обновить UI по полным данным Discord (payload.eventType, payload.data)
});
```

Оба типа сообщений приходят только по гильдиям, на которые клиент подписался через `subscribe` с `guildIds`, и только если пользователь — владелец или администратор гильдии.

---

## Справочник полей

Поля и типы, приходящие в payload событий сокета.

### Событие `guild-state`: поля payload

| Поле | Тип | Описание |
|------|-----|----------|
| `guildId` | string | UUID гильдии в нашей БД. |
| `discordGuildId` | string | Snowflake ID гильдии в Discord. |
| `parameter` | string | Имя параметра: см. таблицу ниже. |
| `direction` | string | `"set"` \| `"inc"` \| `"dec"`. |
| `delta` | number? | Есть только при `direction: "inc"` или `"dec"` — на сколько изменилось значение. |
| `value` | string \| number \| boolean \| object | Зависит от `parameter` — см. таблицу. |
| `timestamp` | string | ISO 8601, время события. |

**Значения `parameter` и тип/содержимое `value`:**

| parameter | direction | value: тип и пример |
|-----------|-----------|----------------------|
| `lastActivity` | set | string (ISO 8601), напр. `"2026-02-06T16:49:48.991Z"`. |
| `memberCount` | set | number — текущее число участников. |
| `voiceOnline` | set | number — участников в голосовых каналах. |
| `threadCreated` | set \| dec | При set — object: `{ threadId, channelId, name? }`. При dec — счёт созданных веток уменьшается на 1 (удаление ветки). |
| `historySyncStatus` | set | string: `"PROCESSING"` \| `"COMPLETED"` \| `"FAILED"`. |
| `totalMessages` | set | number — полное количество сообщений по гильдии (после импорта истории). |
| `bot_status` | set | string: `"installed"` (бот на сервере и получает данные) \| `"not_installed"` (бот удалён или не подключён). |
| `isBotInGuild` | set | boolean. |
| `botConnected` | set | boolean. |
| `guildInfo` | set | object: `{ name?, iconUrl?, banner? }`. |
| `lastSyncAt` | set | string (ISO 8601). |
| `onlineMembers` | set | number. |

---

### Событие `discord-event`: поля payload

| Поле | Тип | Описание |
|------|-----|----------|
| `guildId` | string | UUID гильдии в нашей БД. |
| `discordGuildId` | string | Snowflake гильдии в Discord. |
| `eventType` | string | Тип события Discord (см. ниже). |
| `data` | object | Тело события; структура зависит от `eventType`. |
| `timestamp` | string? | ISO 8601. |

---

### `discord-event`: поля в `data` по типам событий

Структура соответствует [Discord Gateway Events](https://discord.com/developers/docs/topics/gateway-events). Поля могут быть в **camelCase** или **snake_case** (`channelId` / `channel_id` и т.д.).

#### PRESENCE_UPDATE

`data` содержит `old` и `new` — объекты присутствия.

| Поле | Тип | Описание |
|------|-----|----------|
| `userId` | string | Snowflake пользователя. |
| `guild` | string | Snowflake гильдии. |
| `status` | string | `"idle"` \| `"offline"` \| `"online"` \| `"dnd"`. |
| `activities` | array | Массив активностей (часто `[]`). |
| `clientStatus` | object | По клиентам: напр. `{ "web": "idle" }` или `{}`. |

---

#### MESSAGE_CREATE и MESSAGE_UPDATE

В **MESSAGE_CREATE** в `data` приходит один объект сообщения; в **MESSAGE_UPDATE** — `data.old` и `data.new` (два таких объекта). Формат полей (camelCase, возможно дублирование в snake_case: `channel_id`, `author_id` и т.д.):

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Snowflake сообщения. |
| `channelId` | string | Snowflake канала. |
| `guildId` | string | Snowflake гильдии. |
| `createdTimestamp` | number | Время создания (мс, Unix). |
| `editedTimestamp` | number \| null | Время последнего редактирования (мс) или `null`. |
| `type` | number | Тип: `0` — обычное, `21` — системное (напр. создание ветки). |
| `system` | boolean | Системное сообщение. |
| `content` | string | Текст сообщения; может быть `""` (только вложения/эмбеды/стикеры). Заполняется при включённом Message Content Intent у бота. |
| `cleanContent` | string | Текст без разметки. |
| `authorId` | string | Snowflake автора. |
| `author` | object | Автор: минимум `id`, при наличии — `username`, `tag`, `discriminator`, `avatar`. |
| `pinned` | boolean | Закреплено ли. |
| `tts` | boolean | Text-to-speech. |
| `nonce` | string \| null | Служебное. |
| `embeds` | array | Эмбеды. |
| `components` | array | Компоненты (кнопки и т.д.). |
| `attachments` | array | Вложения. |
| `stickers` | array | Стикеры. |
| `position` | number \| null | Позиция в канале. |
| `mentions` | object | `{ everyone, users[], roles[], crosspostedChannels[], repliedUser, members[], channels[] }`. |
| `flags` | number | Битовая маска флагов. |
| `reference` | object \| null | Ответ: `{ channelId, guildId, messageId, type }`. |
| `messageSnapshots` | array | ID сообщений (треды). |
| `roleSubscriptionData` | any | Подписка на роли. |
| `resolved` | any | Резолвы (команды). |
| `webhookId` | string \| null | ID вебхука. |
| `interactionMetadata` | any \| null | Метаданные интеракции. |
| `interaction` | any \| null | Интеракция. |
| `poll` | any \| null | Опрос. |
| `call` | any \| null | Звонок. |

---

#### THREAD_CREATE

`data` — объект ветки (thread channel).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Snowflake ветки. |
| `name` | string | Название ветки. |
| `parentId` | string | Snowflake родительского канала. |
| `guildId` | string | Snowflake гильдии. |
| `guild` | string | То же. |
| `type` | number | `11` — ветка. |
| `ownerId` | string | Snowflake создателя. |
| `messages` | array | Сообщения (часто `[]`). |
| `members` | array | Участники ветки. |
| `flags` | number | Флаги. |
| `locked` | boolean | Закрыта ли. |
| `invitable` | boolean \| null | Можно ли приглашать. |
| `archived` | boolean | В архиве ли. |
| `autoArchiveDuration` | number | Минут до автоархива (напр. 4320). |
| `archiveTimestamp` | number | Время архивации (мс). |
| `lastMessageId` | string \| null | ID последнего сообщения. |
| `lastPinTimestamp` | number \| null | Время последнего пина. |
| `rateLimitPerUser` | number | Лимит сообщений в минуту. |
| `messageCount` | number | Количество сообщений. |
| `memberCount` | number | Участников в ветке. |
| `totalMessageSent` | number | Всего отправлено сообщений. |
| `appliedTags` | array | Теги. |
| `createdTimestamp` | number | Время создания (мс). |

---

#### MESSAGE_DELETE

Событие при удалении сообщения. В `data` — объект с полями (Discord Gateway: [Message Delete](https://discord.com/developers/docs/topics/gateway-events#message-delete)):

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Snowflake удалённого сообщения. |
| `channel_id` | string | Snowflake канала (в camelCase может быть `channelId`). |
| `guild_id` | string? | Snowflake гильдии (только для сообщений в сервере; в camelCase — `guildId`). |

Бэкенд может дополнительно подставлять `author` и `content` из кэша, если они были до удаления. Фронту достаточно обрабатывать минимум: `id`, `channel_id` / `channelId`, при наличии `guild_id` / `guildId`.

---

#### GUILD_MEMBER_ADD

Событие при присоединении участника к серверу. В `data` — объект участника (Discord: [Guild Member Add](https://discord.com/developers/docs/topics/gateway-events#guild-member-add)). Поля могут приходить в snake_case (API) или camelCase (discord.js).

| Поле | Тип | Описание |
|------|-----|----------|
| `guild_id` / `guildId` | string | Snowflake гильдии. |
| `user` | object | Объект пользователя (см. ниже). |
| `roles` | string[] | Массив Snowflake ролей участника. |
| `joined_at` / `joinedAt` | string \| null | ISO 8601 даты присоединения. |
| `nick` | string \| null | Никнейм на сервере. |
| `avatar` | string \| null | Хеш аватарки на сервере (guild-specific). |
| `mute` | boolean | Заглушен в голосе сервером. |
| `deaf` | boolean | Оглушён в голосе сервером. |
| `flags` | number? | Флаги участника (битовая маска). |
| `pending` | boolean? | Не прошёл membership screening. |
| `communication_disabled_until` | string \| null? | ISO 8601 окончания таймаута. |
| `premium_since` / `premiumSince` | string \| null? | ISO 8601 начала буста сервера. |

**Объект `user` (Discord [User](https://discord.com/developers/docs/resources/user#user-object)):**

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Snowflake пользователя. |
| `username` | string | Имя пользователя. |
| `discriminator` | string | Дискриминатор (напр. `"0"`). |
| `global_name` | string \| null? | Глобальное отображаемое имя. |
| `avatar` | string \| null | Хеш аватарки. |
| `bot` | boolean? | Является ли ботом. |
| `banner` | string \| null? | Хеш баннера. |

Для отображения используйте `user.username`, `user.global_name` или `user.discriminator`; при обогащении бэкенд может добавить `user.tag` (username#discriminator).

---

#### GUILD_MEMBER_REMOVE

Событие при выходе участника с сервера. В `data` — объект (Discord: [Guild Member Remove](https://discord.com/developers/docs/topics/gateway-events#guild-member-remove)):

| Поле | Тип | Описание |
|------|-----|----------|
| `guild_id` / `guildId` | string | Snowflake гильдии. |
| `user` | object | Объект пользователя (те же поля, что выше: `id`, `username`, `discriminator`, `avatar` и т.д.). |

---

#### GUILD_MEMBER_UPDATE

Событие при изменении участника (роли, ник, таймаут и т.д.). В `data` — `old` и `new`, оба объекта участника (Discord: [Guild Member Update](https://discord.com/developers/docs/topics/gateway-events#guild-member-update)). Структура каждого объекта — как у GUILD_MEMBER_ADD, плюс:

| Поле | Тип | Описание |
|------|-----|----------|
| `guild_id` / `guildId` | string | Snowflake гильдии. |
| `user` | object | Объект пользователя. |
| `roles` | string[] | Текущий список id ролей. |
| `nick` | string \| null | Ник на сервере. |
| `avatar` | string \| null | Guild avatar hash. |
| `joined_at` / `joinedAt` | string \| null | Когда присоединился. |
| `premium_since` / `premiumSince` | string \| null | Когда начал бустить. |
| `pending` | boolean? | Ожидает проверки. |
| `communication_disabled_until` | string \| null | Окончание таймаута (ISO 8601). |
| `mute` | boolean? | Заглушен в голосе. |
| `deaf` | boolean? | Оглушён в голосе. |
| `flags` | number? | Флаги участника. |

Фронту достаточно сравнивать `old.roles` / `new.roles`, `old.nick` / `new.nick` и при наличии — `communication_disabled_until`.

---

#### VOICE_STATE_UPDATE

Событие при входе/выходе участника из голосового канала или смене состояния (mute/deaf). В `data` — `old` и `new`, оба объекта голосового состояния (Discord: [Voice State Update](https://discord.com/developers/docs/topics/gateway-events#voice-state-update)). Поля могут быть в snake_case или camelCase.

| Поле | Тип | Описание |
|------|-----|----------|
| `user_id` / `userId` | string | Snowflake пользователя. |
| `guild_id` / `guildId` | string | Snowflake гильдии. |
| `session_id` / `sessionId` | string | ID сессии голоса. |
| `channel_id` / `channelId` | string \| null | Snowflake канала; `null` — вышел из голоса. |
| `self_mute` / `selfMute` | boolean | Локально заглушил микрофон. |
| `self_deaf` / `selfDeaf` | boolean | Локально оглушил звук. |
| `self_video` / `selfVideo` | boolean? | Включена камера. |
| `self_stream` / `selfStream` | boolean? | Идёт стрим "Go Live". |
| `mute` | boolean | Заглушен сервером. |
| `deaf` | boolean | Оглушён сервером. |
| `suppress` | boolean | Приглушён (напр. на stage). |
| `request_to_speak_timestamp` | string \| null? | Когда запросил право говорить (ISO 8601). |
| `member` | object? | Объект участника с полем `user` (id, username, tag и т.д.) — при обогащении. |
| `channel` | object? | При обогащении: `{ id, name }` канала. |

Для UI: по `channel_id` / `channelId` определить канал; по `user_id` / `member.user` — кто зашёл/вышел; при `channel_id === null` — участник вышел из голоса.

---

#### GUILD_CREATE

Событие при добавлении бота в гильдию (или при полной загрузке гильдии). В `data` — объект гильдии (Discord: [Guild Create](https://discord.com/developers/docs/topics/gateway-events#guild-create)). Может содержать много полей; основные для фронта:

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Snowflake гильдии. |
| `name` | string | Название сервера. |
| `icon` | string \| null | Хеш иконки. |
| `icon_hash` / `iconHash` | string? | Доп. хеш иконки. |
| `splash` | string \| null? | Хеш splash-картинки. |
| `banner` | string \| null? | Хеш баннера. |
| `owner_id` / `ownerId` | string | Snowflake владельца. |
| `member_count` / `memberCount` | number? | Число участников. |
| `approximate_member_count` / `approximateMemberCount` | number? | Приблизительное число участников. |
| `approximate_presence_count` / `approximatePresenceCount` | number? | Приблизительное число онлайн. |
| `unavailable` | boolean? | Гильдия недоступна (редко при create). |
| `joined_at` / `joinedAt` | string? | Когда бот присоединился (ISO 8601). |
| `channels` | array? | Каналы. |
| `threads` | array? | Ветки. |
| `roles` | array? | Роли. |

Фронт может обновить имя/иконку сервера по `id`, `name`, `icon`, `owner_id`; при наличии — счётчики по `member_count` и т.д.

---

#### GUILD_DELETE

Событие при удалении бота из гильдии или при недоступности гильдии. В `data` — объект (Discord: [Guild Delete](https://discord.com/developers/docs/topics/gateway-events#guild-delete)):

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Snowflake гильдии. |
| `name` | string? | Название (может отсутствовать при unavailable). |
| `icon` | string \| null? | Хеш иконки. |
| `unavailable` | boolean? | `true` — гильдия временно недоступна (например, аутейдж); `false` или отсутствует — бот удалён из гильдии. |

Фронту: при `unavailable === true` можно показать «сервер недоступен»; иначе — «бот удалён с сервера» и убрать гильдию из списка или пометить как неактивную.
