# Settings Endpoints

All settings endpoints require authentication.

## Table of Contents

1. [Server Settings](#131-server-settings)

---

## 13.1 Server Settings

### 13.1.1 Get Server Settings

**Endpoint:** `GET /api/guilds/:guildId/settings`

**Description:** Get server settings for a guild.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `guildId` (string, required) - Discord server (guild) ID

**Response:** `200 OK`
```json
{
  "data": {
    "serverName": "string",
    "serverDescription": "string",
    "language": "string",
    "timezone": "string",
    "botToken": "string",
    "botConnected": true,
    "botUserId": "string",
    "lastConnected": "string",
    "dataRetentionDays": 0,
    "anonymizeUserData": true,
    "shareAnalytics": true,
    "allowPublicWidgets": true
  }
}
```

**Note:** `botToken` field should be masked/encrypted when returned (e.g., `••••••••••••••••`).

### 13.1.2 Update Server Settings

**Endpoint:** `PATCH /api/guilds/:guildId/settings`

**Description:** Update server settings for a guild.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `guildId` (string, required) - Discord server (guild) ID

**Request Body:**
```json
{
  "serverName": "string",
  "serverDescription": "string",
  "language": "string",
  "timezone": "string",
  "botToken": "string",
  "dataRetentionDays": 0,
  "anonymizeUserData": true,
  "shareAnalytics": true,
  "allowPublicWidgets": true
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "serverName": "string",
    "serverDescription": "string",
    "language": "string",
    "timezone": "string",
    "botToken": "string",
    "botConnected": true,
    "botUserId": "string",
    "lastConnected": "string",
    "dataRetentionDays": 0,
    "anonymizeUserData": true,
    "shareAnalytics": true,
    "allowPublicWidgets": true
  }
}
```

**Error Responses:**
- `422 Unprocessable Entity` - Validation errors
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Validation failed",
      "details": {
        "timezone": "Invalid timezone format",
        "botToken": "Invalid bot token"
      }
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
