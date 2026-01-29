# Widget Endpoints

All widget endpoints require authentication (except Get Widget by ID).

## Table of Contents

1. [Widgets](#121-widgets)

---

## 12.1 Widgets

### 12.1.1 Get Widgets

**Endpoint:** `GET /api/guilds/:guildId/widgets`

**Description:** Get list of widgets for a guild.

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
      "guildId": "string",
      "name": "string",
      "config": {
        "type": "stats" | "leaderboard" | "activity",
        "theme": "light" | "dark" | "auto",
        "size": "small" | "medium" | "large",
        "showTitle": true,
        "showLogo": true,
        "customColors": {
          "primary": "string",
          "background": "string",
          "text": "string"
        }
      },
      "embedUrl": "string",
      "embedCode": "string",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ]
}
```

### 12.1.2 Get Widget by ID

**Endpoint:** `GET /api/widgets/:widgetId`

**Description:** Get widget by ID (public endpoint for widget rendering).

**Path Parameters:**
- `widgetId` (string, required) - Widget ID

**Response:** `200 OK`
```json
{
  "data": {
    "id": "string",
    "guildId": "string",
    "name": "string",
    "config": {
      "type": "stats" | "leaderboard" | "activity",
      "theme": "light" | "dark" | "auto",
      "size": "small" | "medium" | "large",
      "showTitle": true,
      "showLogo": true,
      "customColors": {
        "primary": "string",
        "background": "string",
        "text": "string"
      }
    },
    "embedUrl": "string",
    "embedCode": "string",
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

**Error Response:**
- `404 Not Found` - Widget not found
  ```json
  {
    "error": {
      "code": "WIDGET_NOT_FOUND",
      "message": "Widget not found"
    }
  }
  ```

### 12.1.3 Create Widget

**Endpoint:** `POST /api/guilds/:guildId/widgets`

**Description:** Create a new widget for a guild.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `guildId` (string, required) - Discord server (guild) ID

**Request Body:**
```json
{
  "name": "string",
  "config": {
    "type": "stats" | "leaderboard" | "activity",
    "theme": "light" | "dark" | "auto",
    "size": "small" | "medium" | "large",
    "showTitle": true,
    "showLogo": true,
    "customColors": {
      "primary": "string",
      "background": "string",
      "text": "string"
    }
  }
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "string",
    "guildId": "string",
    "name": "string",
    "config": {
      "type": "stats" | "leaderboard" | "activity",
      "theme": "light" | "dark" | "auto",
      "size": "small" | "medium" | "large",
      "showTitle": true,
      "showLogo": true,
      "customColors": {
        "primary": "string",
        "background": "string",
        "text": "string"
      }
    },
    "embedUrl": "string",
    "embedCode": "string",
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

### 12.1.4 Update Widget

**Endpoint:** `PATCH /api/guilds/:guildId/widgets/:widgetId`

**Description:** Update an existing widget.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `guildId` (string, required) - Discord server (guild) ID
- `widgetId` (string, required) - Widget ID

**Request Body:**
```json
{
  "name": "string",
  "config": {
    "type": "stats" | "leaderboard" | "activity",
    "theme": "light" | "dark" | "auto",
    "size": "small" | "medium" | "large",
    "showTitle": true,
    "showLogo": true,
    "customColors": {
      "primary": "string",
      "background": "string",
      "text": "string"
    }
  }
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "id": "string",
    "guildId": "string",
    "name": "string",
    "config": {
      "type": "stats" | "leaderboard" | "activity",
      "theme": "light" | "dark" | "auto",
      "size": "small" | "medium" | "large",
      "showTitle": true,
      "showLogo": true,
      "customColors": {
        "primary": "string",
        "background": "string",
        "text": "string"
      }
    },
    "embedUrl": "string",
    "embedCode": "string",
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

**Error Response:**
- `404 Not Found` - Widget not found
  ```json
  {
    "error": {
      "code": "WIDGET_NOT_FOUND",
      "message": "Widget not found"
    }
  }
  ```

### 12.1.5 Delete Widget

**Endpoint:** `DELETE /api/guilds/:guildId/widgets/:widgetId`

**Description:** Delete a widget.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `guildId` (string, required) - Discord server (guild) ID
- `widgetId` (string, required) - Widget ID

**Response:** `200 OK`
```json
{
  "data": {
    "success": true
  }
}
```

**Error Response:**
- `404 Not Found` - Widget not found
  ```json
  {
    "error": {
      "code": "WIDGET_NOT_FOUND",
      "message": "Widget not found"
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
