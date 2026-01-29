# Analytics Endpoints

## GET /api/analytics/counters

Get statistics about counter usage distribution and popular templates.

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `from?: string` - Start date (ISO 8601 format, e.g., `2024-01-01`)
- `to?: string` - End date (ISO 8601 format, e.g., `2024-01-31`)
- Default: All time if not specified
- Note: DateRangePicker component on the Counters Analytics page should pass these parameters when enabled

**Example Request:**
```
GET /api/analytics/counters?from=2024-01-01&to=2024-01-31
```

**Response:** `200 OK`
```json
{
  "data": {
    "distribution": [
      {
        "type": "members_total",
        "count": 450,
        "percentage": 45.0,
        "popularTemplate": "👥 Members: {count}"
      },
      {
        "type": "members_online",
        "count": 320,
        "percentage": 32.0,
        "popularTemplate": "🟢 Online: {count}"
      }
    ],
    "topTemplates": [
      {
        "template": "👥 Members: {count}",
        "usageCount": 450
      }
    ],
    "totalActive": 1000,
    "avgPerGuild": 3.76
  }
}
```

**Notes:**
- `distribution` array contains counter statistics by type (displayed in Counter Pie Chart)
- `topTemplates` array contains the most popular template strings (displayed in Top Templates Table)
- `totalActive` is the total number of active counters (displayed in Stats Card)
- `avgPerGuild` is the average number of counters per guild (displayed in Stats Card)
- `distribution` array is sorted by count in descending order
- `popularTemplate` source: PostgreSQL `counters.template`

**Response Type:** See [ICounterStatsResponse](data-types.md#icounterstatsresponse) in Data Types

---

## GET /api/analytics/widgets

Get widget analytics including views, clicks, CTR, and top referrers.

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `from?: string` - Start date (ISO 8601 format, e.g., `2024-01-01`)
- `to?: string` - End date (ISO 8601 format, e.g., `2024-01-31`)
- Default: Last 30 days if not specified
- Note: DateRangePicker component on the Widgets Analytics page should pass these parameters when enabled

**Example Request:**
```
GET /api/analytics/widgets?from=2024-01-01&to=2024-01-31
```

**Response:** `200 OK`
```json
{
  "data": {
    "totalViews": 36000,
    "totalClicks": 2700,
    "ctr": 7.5,
    "timeSeries": [
      {
        "date": "2024-01-01",
        "value": 1200,
        "value2": 90
      }
    ],
    "topReferrers": [
      {
        "domain": "top.gg",
        "views": 15000,
        "clicks": 1200
      },
      {
        "domain": "discord.bots.gg",
        "views": 10000,
        "clicks": 750
      }
    ]
  }
}
```

**Notes:**
- `timeSeries.value` = Views (displayed in Widget Composed Chart)
- `timeSeries.value2` = Clicks (displayed in Widget Composed Chart)
- `ctr` = Click-through rate in percentage (calculated as `(totalClicks / totalViews) * 100`)
- `totalViews` and `totalClicks` are aggregated values for the selected date range (not displayed directly in UI but used for calculations)
- `topReferrers` array is sorted by views in descending order (displayed in Referrers Table)

**Response Type:** See [IWidgetStats](data-types.md#iwidgetstats) in Data Types

---

## GET /api/analytics/growth

Get growth statistics including installation sources and invite leaderboard.

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `from?: string` - Start date (ISO 8601 format, e.g., `2024-01-01`)
- `to?: string` - End date (ISO 8601 format, e.g., `2024-01-31`)
- Default: All time if not specified
- Note: DateRangePicker component on the Growth Analytics page should pass these parameters when enabled

**Example Request:**
```
GET /api/analytics/growth?from=2024-01-01&to=2024-01-31
```

**Response:** `200 OK`
```json
{
  "data": {
    "sources": [
      {
        "source": "App Directory",
        "installs": 450,
        "percentage": 45.0
      },
      {
        "source": "Website",
        "installs": 300,
        "percentage": 30.0
      },
      {
        "source": "Friend Invite",
        "installs": 250,
        "percentage": 25.0
      }
    ],
    "leaderboard": [
      {
        "userId": "uuid",
        "username": "TopInviter",
        "avatarUrl": "https://cdn.discordapp.com/avatars/...",
        "invitesCount": 25,
        "retentionRate": 85.5
      }
    ],
    "totalInstalls": 1000
  }
}
```

**Notes:**
- `sources` array contains installation source distribution (displayed in Growth Donut Chart)
- `leaderboard` array contains top inviters sorted by `invitesCount` in descending order (displayed in Invite Leaderboard Table)
- `totalInstalls` is the total number of installations (displayed in the center of Growth Donut Chart)
- `retentionRate` in leaderboard entries is optional and represents the percentage of servers that didn't kick the bot (0-100)

**Response Type:** See [IGrowthStatsResponse](data-types.md#igrowthstatsresponse) in Data Types

---

## GET /api/analytics/commands

Get command usage statistics.

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `from?: string` - Start date (ISO 8601 format, e.g., `2024-01-01`)
- `to?: string` - End date (ISO 8601 format, e.g., `2024-01-31`)
- Default: All time if not specified
- Note: DateRangePicker component on the Commands Analytics page should pass these parameters when enabled

**Example Request:**
```
GET /api/analytics/commands?from=2024-01-01&to=2024-01-31
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "commandName": "setup",
      "category": "Setup",
      "executionCount": 5000,
      "errorCount": 50,
      "errorRate": 1.0,
      "avgLatency": 120
    },
    {
      "commandName": "stats",
      "category": "Analytics",
      "executionCount": 8000,
      "errorCount": 40,
      "errorRate": 0.5,
      "avgLatency": 80
    }
  ]
}
```

**Notes:**
- `errorRate` is percentage: `(errorCount / executionCount) * 100`
- `avgLatency` is in milliseconds
- Response is an array of command metrics, sorted by `executionCount` in descending order
- Each entry represents statistics for a single command over the specified date range

**Response Type:** `ICommandMetric[]` - See [ICommandMetric](data-types.md#icommandmetric) in Data Types

---

## GET /api/analytics/leaderboards

Get guild leaderboards (top guilds by members, interaction, etc.).

**Headers:**
- `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Awesome Server",
      "iconUrl": "https://cdn.discordapp.com/icons/...",
      "memberCount": 50000,
      "ownerName": "OwnerUsername",
      "plan": "enterprise"
    }
  ]
}
```

**Notes:**
- Response contains top guilds sorted by member count or interaction metrics
- `ownerName` field contains the username of the guild owner
- `plan` field indicates the subscription plan of the guild owner
- This endpoint is used for displaying leaderboards on analytics pages

**Response Type:** `IGuildLeaderboardEntry[]` - See [IGuildLeaderboardEntry](data-types.md#iguildleaderboardentry) in Data Types

---

**Next:** [Users](users.md) | [Back to README](README.md)
