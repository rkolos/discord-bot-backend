# Guild (Discord Server) Endpoints

All guild endpoints require authentication.

## Table of Contents

1. [Guild List](#61-guild-list)
2. [Guild Details](#62-guild-details)

---

## 6.1 Guild List

### 6.1.1 Get User's Guilds

**Endpoint:** `GET /api/me/guilds`

**Description:** Get list of Discord servers (guilds) for current user. `messageCount` per guild is computed from analytics storage (ClickHouse). Returns `503 ANALYTICS_UNAVAILABLE` if ClickHouse is temporarily unavailable.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Query Parameters:**
- `page` (number, optional, default: 1) - Page number
- `limit` (number, optional, default: 20) - Items per page
- `search` (string, optional) - Search by guild name

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "icon": "string",
      "status": "active" | "inactive" | "error",
      "memberCount": 0,
      "messageCount": 0,
      "lastActivity": "string",
      "ownerId": "string",
      "subscriptionTier": "free" | "pro" | "enterprise",
      "onlineMembers": 0,
      "memberGrowth": 0,
      "banner": "string"
    }
  ],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### 6.1.2 Get Guilds by Company

**Endpoint:** `GET /api/companies/:companyId/guilds`

**Description:** Get list of guilds for a specific company/workspace. `messageCount` per guild is computed from analytics storage (ClickHouse). Returns `503 ANALYTICS_UNAVAILABLE` if ClickHouse is temporarily unavailable.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `companyId` (string, required) - Company/workspace ID

**Query Parameters:**
- `page` (number, optional, default: 1) - Page number
- `limit` (number, optional, default: 20) - Items per page
- `search` (string, optional) - Search by guild name

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "icon": "string",
      "status": "active" | "inactive" | "error",
      "memberCount": 0,
      "messageCount": 0,
      "lastActivity": "string",
      "ownerId": "string",
      "subscriptionTier": "free" | "pro" | "enterprise",
      "onlineMembers": 0,
      "memberGrowth": 0,
      "banner": "string"
    }
  ],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

## 6.2 Guild Details

### 6.2.1 Get Server Stats

**Endpoint:** `GET /api/guilds/:guildId/stats`

**Description:** Get statistics for a specific Discord server. `totalMessages` is computed from analytics storage (ClickHouse).

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `guildId` (string, required) - Discord server (guild) ID

**Response:** `200 OK`
```json
{
  "data": {
    "totalMembers": 0,
    "totalMessages": 0,
    "activeMembers": 0,
    "voiceMinutes": 0
  }
}
```

**Error Response:**
- `404 Not Found` - Guild not found or user doesn't have access
  ```json
  {
    "error": {
      "code": "GUILD_NOT_FOUND",
      "message": "Guild not found or access denied"
    }
  }
  ```
- `503 Service Unavailable` - Analytics storage (ClickHouse) is temporarily unavailable
  ```json
  {
    "error": {
      "code": "ANALYTICS_UNAVAILABLE",
      "message": "Analytics storage (ClickHouse) is temporarily unavailable. ..."
    }
  }
  ```

### 6.2.2 Get Bot Status

**Endpoint:** `GET /api/guilds/:guildId/bot-status`

**Description:** Get bot connection status for a guild.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `guildId` (string, required) - Discord server (guild) ID

**Response:** `200 OK`
```json
{
  "data": {
    "status": "online" | "offline" | "error",
    "lastSeen": "string",
    "version": "string"
  }
}
```

### 6.2.3 Get Guild Modules

**Endpoint:** `GET /api/guilds/:guildId/modules`

**Description:** Get list of enabled/disabled modules for a guild.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `guildId` (string, required) - Discord server (guild) ID

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "enabled": true,
      "hasError": false
    }
  ]
}
```

### 6.2.4 Get Guild Activity Sparkline

**Endpoint:** `GET /api/guilds/:guildId/activity-sparkline`

**Description:** Get activity sparkline data (message counts per hour for last 24 hours).

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `guildId` (string, required) - Discord server (guild) ID

**Response:** `200 OK`
```json
{
  "data": [0, 0, 0],
  "level": "quiet"
}
```

- `data` — array of 24 numbers (message counts per hour, most recent hour first).
- `level` — activity level: `"live"` | `"active"` | `"quiet"`.
  - **live** — бот подключён к Discord (`server_settings.bot_connected === true`).
  - **active** — за последние сутки ≥ 1 сообщение (или последний час ≥ 5).
  - **quiet** — за последние сутки < 1 сообщение или нет данных (пустой массив).

### 6.2.5 Welcome Message Settings

**Endpoint:** `GET /api/guilds/:guildId/welcome`

**Description:** Get welcome message settings (channel, enabled, message type, content). When a member joins the server, the bot can send a configurable text and/or embed to a chosen channel. Bearer JWT, guild admin.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `guildId` (string, required) - Discord server (guild) ID

**Response:** `200 OK`
```json
{
  "data": {
    "channelId": "string | null",
    "enabled": true,
    "messageType": "text" | "embed" | "text_and_embed",
    "contentText": "string | null",
    "contentEmbed": { "title": "string", "description": "string", "color": 0, "fields": [{ "name": "string", "value": "string" }] } | null
  }
}
```

If no settings exist, returns defaults: `enabled: false`, `channelId: null`, `messageType: "text"`, `contentText: null`, `contentEmbed: null`.

**Endpoint:** `PATCH /api/guilds/:guildId/welcome`

**Description:** Update welcome message settings. Body: optional `channelId`, `enabled`, `messageType`, `contentText`, `contentEmbed`. `channelId` must be Snowflake or null. `messageType`: `text`, `embed`, or `text_and_embed`. `contentEmbed` allows optional `title`, `description`, `color` (0..0xFFFFFF), `fields` (array of `{ name, value }`). Discord length limits apply (e.g. contentText 2000, embed title 256). Bearer JWT, guild admin.

**Response:** `200 OK` — same shape as GET.

**Error Response:** `404 Not Found` — `GUILD_NOT_FOUND` (guild not found or access denied).

### 6.2.6 Goodbye Message Settings

**Endpoint:** `GET /api/guilds/:guildId/goodbye`

**Description:** Get goodbye message settings. When a member leaves the server, the bot can send a configurable text and/or embed to a chosen channel. Same response shape as welcome.

**Endpoint:** `PATCH /api/guilds/:guildId/goodbye`

**Description:** Update goodbye message settings. Same body and validation as PATCH welcome.

**Error Response:** `404 Not Found` — `GUILD_NOT_FOUND`.

---

## Related Documentation

- [Introduction](./00-introduction.md)
- [Authentication](./01-authentication.md)
- [Error Codes](./12-error-codes.md)
- [Data Types Reference](./13-data-types.md)
