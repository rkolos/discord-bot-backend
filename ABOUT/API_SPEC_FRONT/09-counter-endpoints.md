# Counter Endpoints

All counter endpoints require authentication.

## Table of Contents

1. [Channels](#111-channels)
2. [Counters](#112-counters)

---

## 11.1 Channels

### 11.1.1 Get Channels

**Endpoint:** `GET /api/guilds/:guildId/channels`

**Description:** Get list of channels (text, voice, category) for a guild.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `guildId` (string, required) - Discord server (guild) ID

**Query Parameters:**
- `type` (string, optional) - Filter by channel type: `text`, `voice`, or `category`

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "type": "text" | "voice" | "category"
    }
  ]
}
```

---

## 11.2 Counters

### 11.2.1 Get Counters

**Endpoint:** `GET /api/guilds/:guildId/counters`

**Description:** Get list of counters for a guild.

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
      "channelId": "string",
      "channelName": "string",
      "type": "stat" | "goal" | "clock",
      "metric": "members" | "messages" | "voice" | "online" | "idle" | "dnd" | "offline" | "role",
      "roleId": "string | null",
      "template": "string",
      "status": "active" | "inactive" | "error",
      "currentValue": 0,
      "target": 0,
      "timezone": "string",
      "dateFormat": "string",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ]
}
```

### 11.2.2 Create Counter

**Endpoint:** `POST /api/guilds/:guildId/counters`

**Description:** Create a new counter for a guild.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `guildId` (string, required) - Discord server (guild) ID

**Request Body:**
```json
{
  "channelId": "string",
  "type": "stat" | "goal" | "clock",
  "metric": "members" | "messages" | "voice" | "online" | "idle" | "dnd" | "offline" | "role",
  "roleId": "string (required when metric is role; Discord role ID, Snowflake)",
  "template": "string",
  "target": 0,
  "timezone": "string",
  "dateFormat": "string"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "string",
    "channelId": "string",
    "channelName": "string",
    "type": "stat" | "goal" | "clock",
    "metric": "members" | "messages" | "voice" | "online" | "idle" | "dnd" | "offline" | "role",
    "roleId": "string | null",
    "template": "string",
    "status": "active" | "inactive" | "error",
    "currentValue": 0,
    "target": 0,
    "timezone": "string",
    "dateFormat": "string",
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

**Error Responses:**
- `403 Forbidden` - Bot does not have required permissions in the channel
  ```json
  {
    "error": {
      "code": "INSUFFICIENT_BOT_PERMISSIONS",
      "message": "Bot does not have Manage Channels permission in the specified channel"
    }
  }
  ```
- `422 Unprocessable Entity` - Validation errors
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Validation failed",
      "details": {
        "channelId": "Channel not found",
        "metric": "Metric is required for 'stat' and 'goal' types"
      }
    }
  }
  ```

### 11.2.3 Update Counter

**Endpoint:** `PATCH /api/guilds/:guildId/counters/:counterId`

**Description:** Update an existing counter.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `guildId` (string, required) - Discord server (guild) ID
- `counterId` (string, required) - Counter ID

**Request Body:**
```json
{
  "channelId": "string",
  "type": "stat" | "goal" | "clock",
  "metric": "members" | "messages" | "voice" | "online" | "idle" | "dnd" | "offline" | "role",
  "roleId": "string | null",
  "template": "string",
  "status": "active" | "inactive" | "error",
  "target": 0,
  "timezone": "string",
  "dateFormat": "string"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "id": "string",
    "channelId": "string",
    "channelName": "string",
    "type": "stat" | "goal" | "clock",
    "metric": "members" | "messages" | "voice" | "online" | "idle" | "dnd" | "offline" | "role",
    "roleId": "string | null",
    "template": "string",
    "status": "active" | "inactive" | "error",
    "currentValue": 0,
    "target": 0,
    "timezone": "string",
    "dateFormat": "string",
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

**Error Response:**
- `404 Not Found` - Counter not found
  ```json
  {
    "error": {
      "code": "COUNTER_NOT_FOUND",
      "message": "Counter not found"
    }
  }
  ```

### 11.2.4 Delete Counter

**Endpoint:** `DELETE /api/guilds/:guildId/counters/:counterId`

**Description:** Delete a counter.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `guildId` (string, required) - Discord server (guild) ID
- `counterId` (string, required) - Counter ID

**Response:** `200 OK`
```json
{
  "data": {
    "success": true
  }
}
```

**Error Response:**
- `404 Not Found` - Counter not found
  ```json
  {
    "error": {
      "code": "COUNTER_NOT_FOUND",
      "message": "Counter not found"
    }
  }
  ```

---

## Related Documentation

- [Introduction](./00-introduction.md)
- [Authentication](./01-authentication.md)
- [Guild Endpoints](./04-guild-endpoints.md)
- [Error Codes](./12-error-codes.md)
- [Data Types Reference](./13-data-types.md)
