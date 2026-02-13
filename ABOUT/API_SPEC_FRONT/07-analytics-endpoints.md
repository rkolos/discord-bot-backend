# Analytics Endpoints

All analytics endpoints require authentication.

## Table of Contents

1. [Analytics Data](#91-analytics-data)
2. [Heatmap](#92-heatmap)
3. [Event Types](#93-event-types)
4. [Events Time Series](#94-events-time-series)
5. [Events Search](#95-events-search)

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

## 9.3 Event Types

### 9.3.1 Get Event Types

**Endpoint:** `GET /api/guilds/:guildId/analytics/event-types`

**Description:** Returns list of Discord event types available for filtering in analytics (events-timeseries, events search) and for the analytics blacklist setting.

**Headers:** `Authorization: Bearer <token>` (required)

**Path Parameters:** `guildId` (string, required)

**Response:** `200 OK`
```json
{
  "data": ["MESSAGE_CREATE", "MESSAGE_UPDATE", "MESSAGE_DELETE", "GUILD_MEMBER_ADD", "GUILD_MEMBER_REMOVE", "GUILD_MEMBER_UPDATE", "VOICE_STATE_UPDATE", "THREAD_CREATE", "GUILD_CREATE", "GUILD_DELETE", "PRESENCE_UPDATE"]
}
```

---

## 9.4 Events Time Series

### 9.4.1 Get Events Time Series

**Endpoint:** `GET /api/guilds/:guildId/analytics/events-timeseries`

**Description:** Returns time series of event counts grouped by date (day/week/month) and event type.

**Query Parameters:** `from` (required), `to` (required), `groupBy` (optional: day | week | month), `eventTypes` (optional array), `timezone` (optional)

**Response:** `200 OK`
```json
{
  "data": [
    { "date": "2026-01-15", "eventType": "MESSAGE_CREATE", "count": 120 },
    { "date": "2026-01-15", "eventType": "GUILD_MEMBER_ADD", "count": 3 }
  ]
}
```

---

## 9.5 Events Search

### 9.5.1 Get Events (Search)

**Endpoint:** `GET /api/guilds/:guildId/analytics/events`

**Description:** Returns paginated list of raw events with optional filters. Each event includes `channelName` (from Discord) when available.

**Query Parameters:** `from` (required), `to` (required), `eventTypes` (optional array), `channelId` (optional), `limit` (optional, 1–100, default 50), `cursor` (optional: `{ eventId, eventTime }` for next page)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "eventId": "uuid",
      "eventTime": "2026-01-15T12:00:00.000Z",
      "eventType": "MESSAGE_CREATE",
      "channelId": "123456789",
      "channelName": "general",
      "payloadSummary": { "userId": "999", "messageId": "111" }
    }
  ],
  "nextCursor": { "eventId": "uuid", "eventTime": "2026-01-15T11:00:00.000Z" }
}
```

**Pagination:** Pass `cursor` from `nextCursor` in the next request with the same `from`, `to`, and filters to fetch the next page. If `nextCursor` is absent, there are no more pages.

---

## Related Documentation

- [Introduction](./00-introduction.md)
- [Authentication](./01-authentication.md)
- [Guild Endpoints](./04-guild-endpoints.md)
- [Error Codes](./12-error-codes.md)
- [Data Types Reference](./13-data-types.md)
