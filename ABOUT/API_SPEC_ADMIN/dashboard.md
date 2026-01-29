# Dashboard Endpoints

## GET /api/dashboard/overview

Get dashboard overview statistics including KPIs, growth trends, and system status.

**Headers:**
- `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "data": {
    "activeUsers": {
      "current": 1250,
      "trend": 5.2
    },
    "totalGuilds": {
      "current": 850,
      "trend": 3.1
    },
    "totalCounters": {
      "current": 3200,
      "trend": 8.5
    },
    "mrr": {
      "current": 12500,
      "currency": "USD"
    },
    "growthData": [
      {
        "date": "2024-01-01",
        "value": 1000
      }
    ],
    "featureLeaderboard": [
      {
        "type": "members_total",
        "count": 450,
        "percentage": 45.0,
        "popularTemplate": "👥 Members: {count}"
      }
    ],
    "systemStatus": {
      "api": "healthy",
      "gateway": "healthy",
      "database": "healthy"
    }
  }
}
```

**Notes:**
- `trend` values are percentages calculated on backend (e.g., `5.2` means +5.2% growth)
- `growthData` contains time series for the last 30 days (displayed in Growth Chart component)
- `featureLeaderboard` contains top 3 counter types sorted by count (displayed in Feature Leaderboard component)
- `systemStatus` values: `"healthy" | "degraded" | "down"` (displayed in System Health component with color indicators)
- All KPI cards display `current` value and `trend` percentage (with up/down indicators)
- MRR card displays `current` value formatted as currency using `currency` field

**Response Type:** See [IDashboardStats](data-types.md#idashboardstats) in Data Types

---

**Next:** [Analytics](analytics.md) | [Back to README](README.md)
