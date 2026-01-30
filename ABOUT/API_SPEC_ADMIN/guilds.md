# Guilds Endpoints

## GET /api/guilds

Get paginated list of guilds (Discord servers) with filtering and sorting.

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `page?: number` - Page number (default: `1`)
- `limit?: number` - Items per page (default: `10`, max: `100`)
- `search?: string` - Search query (searches in `name`, `discordGuildId`)
- `minMembers?: number` - Filter by minimum member count
- `sortBy?: string` - Sort field: `"memberCount" | "joinedAt"` (default: `"joinedAt"`)
- `sortOrder?: string` - Sort order: `"asc" | "desc"` (default: `"desc"`)
- Note: Sorting is performed server-side. The guilds table allows sorting by `memberCount` (displayed as "Members") and `joinedAt` (displayed as "Install Date")

**Example Request:**
```
GET /api/guilds?page=1&limit=20&search=awesome&minMembers=1000&sortBy=memberCount&sortOrder=desc
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "discordGuildId": "987654321098765432",
      "name": "Awesome Server",
      "iconUrl": "https://cdn.discordapp.com/icons/...",
      "ownerId": "uuid",
      "memberCount": 5000,
      "shardId": 2,
      "isBotInGuild": true,
      "activeCountersCount": 3,
      "widgetsCreatedCount": 1,
      "joinedAt": "2024-01-15T00:00:00.000Z",
      "historySyncStatus": "COMPLETED"
    }
  ],
  "meta": {
    "total": 850,
    "page": 1,
    "limit": 20,
    "totalPages": 43,
    "hasNextPage": true
  }
}
```

**Notes:**
- The `ownerId` field contains the UUID of the user who owns the guild
- To display owner username and avatar in the guilds table, use `GET /api/users/:id` with the `ownerId` from each guild entry
- The response includes all fields needed for the guilds table display: `name`, `iconUrl`, `memberCount`, `activeCountersCount`, `joinedAt`
- Note: The "Invite Bot" action in the guilds table actions menu generates an invite link client-side using `discordGuildId` and does not require an API endpoint
- `historySyncStatus` indicates the status of historical message import for the guild: `PENDING` | `PROCESSING` | `COMPLETED` | `FAILED`

**Response Type:** Paginated response - See [IGuild](data-types.md#iguild) and [PaginationMeta](data-types.md#paginationmeta) in Data Types

---

## GET /api/guilds/:id

Get detailed guild information including configuration and statistics.

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id: string` - Guild UUID

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "discordGuildId": "987654321098765432",
    "name": "Awesome Server",
    "iconUrl": "https://cdn.discordapp.com/icons/...",
    "ownerId": "uuid",
    "memberCount": 5000,
    "shardId": 2,
    "isBotInGuild": true,
    "activeCountersCount": 3,
    "widgetsCreatedCount": 1,
    "joinedAt": "2024-01-15T00:00:00.000Z",
    "historySyncStatus": "COMPLETED",
    "config": {
      "counters": {
        "enabled": true,
        "channels": [
          {
            "channelId": "123456789012345678",
            "type": "members_total",
            "template": "👥 Members: {count}"
          }
        ]
      },
      "widgets": {
        "enabled": true,
        "theme": "dark",
        "style": "modern"
      },
      "modules": {
        "logging": {
          "enabled": true,
          "channelId": "123456789012345678"
        }
      }
    },
    "stats": {
      "messageActivity": [
        {
          "date": "2024-01-27",
          "count": 5000
        }
      ],
      "ticketVolume": [
        {
          "date": "2024-01-27",
          "count": 25
        }
      ]
    },
    "isPremium": true,
    "isVerified": false
  }
}
```

**Notes:**
- To get full owner information (username, avatar), use `GET /api/users/:id` with the `ownerId` from this response
- The `ownerId` field contains the UUID of the user who owns this guild
- `stats.messageActivity` contains time series data for message activity over the last 30 days (used for Message Activity chart)
- `stats.ticketVolume` is optional and contains time series data for ticket creation (used for Ticket Volume chart)
- `config` is a JSON object containing the full bot configuration for this guild (displayed in Config Viewer)
- `historySyncStatus` indicates the status of historical message import: `PENDING` | `PROCESSING` | `COMPLETED` | `FAILED`

**Error Responses:**
- `404 Not Found` - Guild not found
  ```json
  {
    "error": {
      "code": "GUILD_NOT_FOUND",
      "message": "Guild with id 'uuid' not found"
    }
  }
  ```

**Response Type:** See [IGuildDetail](data-types.md#iguilddetail) in Data Types

---

## DELETE /api/guilds/:id

Force leave a guild (remove bot from server).

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id: string` - Guild UUID

**Response:** `200 OK`
```json
{
  "data": {
    "success": true
  }
}
```

**Notes:**
- This action is triggered from the "Force Leave Server" button in the Danger Zone section of the guild detail page
- A confirmation dialog is shown before executing the action
- The button is disabled if `isBotInGuild` is `false`

**Error Responses:**
- `404 Not Found` - Guild not found
- `400 Bad Request` - Bot is already not in guild

---

**Next:** [System Health](system-health.md) | [Back to README](README.md)
