# Leaderboard Endpoints

All leaderboard endpoints require authentication.

## Table of Contents

1. [Leaderboard](#101-leaderboard)

---

## 10.1 Leaderboard

### 10.1.1 Get Leaderboard

**Endpoint:** `GET /api/guilds/:guildId/leaderboard`

**Description:** Get leaderboard entries for a guild with sorting and pagination.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `guildId` (string, required) - Discord server (guild) ID

**Query Parameters:**
- `sortBy` (string, optional, default: "rank") - Sort field: `messages`, `voice`, or `rank`
- `sortOrder` (string, optional, default: "desc") - Sort order: `asc` or `desc`
- `page` (number, optional, default: 1) - Page number
- `pageSize` (number, optional, default: 20) - Items per page

**Response:** `200 OK`
```json
{
  "data": {
    "entries": [
      {
        "rank": 0,
        "userId": "string",
        "username": "string",
        "avatar": "string",
        "messages": 0,
        "voiceMinutes": 0
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 0
    }
  }
}
```

**Error Response:**
- `400 Bad Request` - Invalid sort parameters
  ```json
  {
    "error": {
      "code": "INVALID_SORT_PARAMETER",
      "message": "Invalid sortBy or sortOrder parameter"
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
