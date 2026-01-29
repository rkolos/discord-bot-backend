# Analytics Endpoints

All analytics endpoints require authentication.

## Table of Contents

1. [Analytics Data](#91-analytics-data)
2. [Heatmap](#92-heatmap)

---

## 9.1 Analytics Data

### 9.1.1 Get Analytics Data

**Endpoint:** `GET /api/guilds/:guildId/analytics`

**Description:** Get comprehensive analytics data for a guild within a date range.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `guildId` (string, required) - Discord server (guild) ID

**Query Parameters:**
- `from` (string, required) - Start date; **ISO 8601 date format YYYY-MM-DD** (e.g., `2026-01-01`)
- `to` (string, required) - End date; **ISO 8601 date format YYYY-MM-DD** (e.g., `2026-01-27`). All date/period parameters in analytics endpoints use this standard.

**Response:** `200 OK`
```json
{
  "data": {
    "timeSeries": [
      {
        "date": "string",
        "messages": 0,
        "members": 0,
        "voiceMinutes": 0
      }
    ],
    "heatmap": [
      {
        "dayOfWeek": 0,
        "hour": 0,
        "value": 0
      }
    ],
    "summary": {
      "totalMessages": 0,
      "totalMembers": 0,
      "totalVoiceMinutes": 0,
      "averageMessagesPerDay": 0,
      "averageMembersPerDay": 0
    },
    "topChannels": {
      "messages": [
        {
          "id": "string",
          "name": "string",
          "type": "text",
          "value": 0
        }
      ],
      "voice": [
        {
          "id": "string",
          "name": "string",
          "type": "voice",
          "value": 0
        }
      ]
    },
    "topMembers": [
      {
        "id": "string",
        "username": "string",
        "discriminator": "string",
        "avatar": "string",
        "messages": 0,
        "voiceMinutes": 0
      }
    ],
    "roleDistribution": [
      {
        "id": "string",
        "name": "string",
        "color": "string",
        "count": 0
      }
    ],
    "topCommands": [
      {
        "id": "string",
        "name": "string",
        "usageCount": 0,
        "lastUsedAt": "string",
        "category": "string"
      }
    ]
  }
}
```

**Note:** If `anonymize_user_data` is enabled for the guild, `topMembers[].username` and `topMembers[].avatar` are returned as `"Anonymous"`. Each `topMembers` entry includes `voiceMinutes`.

**Behavior when no data:** For endpoints that return time-series data (e.g. `timeSeries` in this response), when there are **no events in storage** for the requested period, the server must return an **array with zero values for every date in the period**, not an empty array. This ensures correct chart rendering on the frontend (date axis and zeros instead of a blank chart). The same applies to `heatmap`: when there is no activity data, return all cells (dayOfWeek × hour) with `value: 0`.

**Voice activity and historical data:** If there are **no data for voice activity** (voiceMinutes, voice-related metrics) for the selected period — which is typical when the period is covered only by historical message import (history does not include voice events) — the API must return **zeros** for voice-related fields (e.g. `timeSeries[].voiceMinutes = 0`, `summary.totalVoiceMinutes = 0`, `topMembers[].voiceMinutes = 0` where applicable) while **successfully** returning data for messages (e.g. `messages_count`, `topMembers` by messages). The frontend must not treat an empty or zero voice chart as an error and must not fail; an empty voice graph should be displayed as zeros.

**Error Responses:**
- `400 Bad Request` - Invalid date range
  ```json
  {
    "error": {
      "code": "INVALID_DATE_RANGE",
      "message": "Invalid date range. 'from' must be before 'to'"
    }
  }
  ```
- `404 Not Found` - Guild not found
  ```json
  {
    "error": {
      "code": "GUILD_NOT_FOUND",
      "message": "Guild not found or access denied"
    }
  }
  ```

---

## 9.2 Heatmap

### 9.2.1 Get Heatmap Data

**Endpoint:** `GET /api/guilds/:guildId/heatmap`

**Description:** Get heatmap data (activity by day of week and hour).

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `guildId` (string, required) - Discord server (guild) ID

**Response:** `200 OK`
```json
{
  "data": [
    {
      "dayOfWeek": 0,
      "hour": 0,
      "value": 0
    }
  ]
}
```

**Note:** `dayOfWeek` is 0-6 (Sunday=0, Saturday=6), `hour` is 0-23. When there is no activity data, the endpoint returns all cells (dayOfWeek × hour) with `value: 0` (see behavior when no data in 9.1.1).

---

## Related Documentation

- [Introduction](./00-introduction.md)
- [Authentication](./01-authentication.md)
- [Guild Endpoints](./04-guild-endpoints.md)
- [Error Codes](./12-error-codes.md)
- [Data Types Reference](./13-data-types.md)
