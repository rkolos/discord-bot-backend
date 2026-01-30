# Users Endpoints

## GET /api/users

Get paginated list of users with filtering and sorting.

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `page?: number` - Page number (default: `1`)
- `limit?: number` - Items per page (default: `10`, max: `100`)
- `search?: string` - Search query (searches in `username`, `email`, `discordId`)
- `status?: string` - Filter by status: `"active" | "banned" | "all"` (default: `"all"`)
- `plan?: string` - Filter by plan: `"free" | "pro" | "enterprise" | "all"` (default: `"all"`)
- `sortBy?: string` - Sort field: `"createdAt" | "lastLoginAt" | "username"` (default: `"createdAt"`)
- `sortOrder?: string` - Sort order: `"asc" | "desc"` (default: `"desc"`)
- Note: Sorting is performed server-side. The users table allows sorting by `createdAt` column (displayed as "Joined")

**Example Request:**
```
GET /api/users?page=1&limit=20&search=john&status=active&plan=pro&sortBy=lastLoginAt&sortOrder=desc
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "discordId": "123456789012345678",
      "username": "SuperGamer",
      "discriminator": "0000",
      "avatarUrl": "https://cdn.discordapp.com/avatars/...",
      "email": "user@example.com",
      "plan": "pro",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLoginAt": "2024-01-27T12:00:00.000Z",
      "ownedGuildsCount": 5
    }
  ],
  "meta": {
    "total": 1250,
    "page": 1,
    "limit": 20,
    "totalPages": 63,
    "hasNextPage": true
  }
}
```

**Notes:**
- Response includes all fields needed for the users table: `username`, `avatarUrl`, `discordId`, `createdAt`, `plan`, `status`
- `discriminator` field is included but may be empty for newer Discord accounts (Discord removed discriminators)
- `ownedGuildsCount` is a computed field showing the total number of guilds owned by the user
- Sorting by `createdAt` is supported (default)
- Sorting by `lastLoginAt` is supported
- Sorting by `username` is supported (alphabetical)

**Response Type:** Paginated response - See [IUser](data-types.md#iuser) and [PaginationMeta](data-types.md#paginationmeta) in Data Types

---

## GET /api/users/:id

Get detailed user information including activity log and owned guilds.

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id: string` - User UUID

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "discordId": "123456789012345678",
    "username": "SuperGamer",
    "discriminator": "0000",
    "avatarUrl": "https://cdn.discordapp.com/avatars/...",
    "email": "user@example.com",
    "plan": "pro",
    "status": "active",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastLoginAt": "2024-01-27T12:00:00.000Z",
    "ownedGuildsCount": 5,
    "activityLog": [
      {
        "id": "uuid",
        "action": "Updated server settings",
        "timestamp": "2024-01-27T10:00:00.000Z",
        "details": "Changed counter template"
      }
    ],
    "balance": 150.50,
    "ownedGuilds": [
      {
        "id": "uuid",
        "discordGuildId": "987654321098765432",
        "name": "My Server",
        "iconUrl": "https://cdn.discordapp.com/icons/...",
        "ownerId": "uuid",
        "memberCount": 5000,
        "shardId": 2,
        "isBotInGuild": true,
        "activeCountersCount": 3,
        "widgetsCreatedCount": 1,
        "joinedAt": "2024-01-15T00:00:00.000Z"
      }
    ]
  }
}
```

**Notes:**
- `activityLog` array contains recent user actions, sorted by `timestamp` in descending order (newest first)
- `ownedGuilds` array contains all guilds owned by this user (displayed in Owned Guilds List component)
- `balance` is optional and represents the user's current account balance (displayed in Quick Metrics Card)
- All fields from base `IUser` interface are included
- `activityLog` entries are displayed in Activity tab with formatted timestamps and action icons
- `ownedGuilds` entries are displayed in Overview tab as clickable cards showing: `name`, `iconUrl`, `memberCount`, `activeCountersCount`, `widgetsCreatedCount`, `isBotInGuild` status

**Error Responses:**
- `404 Not Found` - User not found
  ```json
  {
    "error": {
      "code": "USER_NOT_FOUND",
      "message": "User with id 'uuid' not found"
    }
  }
  ```

**Response Type:** See [IUserDetail](data-types.md#iuserdetail) in Data Types

---

## POST /api/users/:id/ban

Ban a user.

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id: string` - User UUID

**Request Body:**
```json
{
  "reason": "Violation of terms of service" // Optional - reason for banning the user
}
```

**Notes:**
- The `reason` field is optional and can be provided in the ban confirmation dialog
- If not provided, the request body can be empty `{}` or omitted entirely

**Response:** `200 OK`
```json
{
  "data": {
    "success": true
  }
}
```

**Error Responses:**
- `404 Not Found` - User not found
- `400 Bad Request` - User already banned

---

## POST /api/users/:id/unban

Unban a user.

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id: string` - User UUID

**Response:** `200 OK`
```json
{
  "data": {
    "success": true
  }
}
```

**Error Responses:**
- `404 Not Found` - User not found
- `400 Bad Request` - User is not banned

---

## POST /api/users/:id/impersonate

Generate temporary token to impersonate a user (for support purposes).

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id: string` - User UUID

**Response:** `200 OK`
```json
{
  "data": {
    "token": "temporary_impersonation_token_..."
  }
}
```

**Notes:**
- Token should be used to redirect to main application with impersonation context
- Token has limited lifetime (e.g., 1 hour)

**Error Responses:**
- `404 Not Found` - User not found
- `403 Forbidden` - Insufficient permissions for impersonation

---

## GET /api/users/:id/billing

Get billing history and transaction information for a user.

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id: string` - User UUID

**Query Parameters:**
- `page?: number` - Page number (default: `1`)
- `limit?: number` - Items per page (default: `10`, max: `50`)

**Response:** `200 OK`
```json
{
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "type": "subscription",
        "amount": 9.99,
        "currency": "USD",
        "status": "completed",
        "description": "Pro Monthly Subscription",
        "createdAt": "2024-01-15T00:00:00.000Z"
      },
      {
        "id": "uuid",
        "type": "one_time",
        "amount": 29.99,
        "currency": "USD",
        "status": "completed",
        "description": "One-time payment",
        "createdAt": "2024-01-10T00:00:00.000Z"
      }
    ],
    "meta": {
      "total": 25,
      "page": 1,
      "limit": 10,
      "totalPages": 3
    }
  }
}
```

**Notes:**
- This endpoint is optional and may not be implemented in the first version
- Used by the "Billing" tab in the User Detail page (currently shows "Coming soon" placeholder)
- Transaction types: `"subscription"`, `"one_time"`, `"refund"`
- Transaction statuses: `"completed"`, `"pending"`, `"failed"`
- Response includes pagination metadata for the transactions list

**Error Responses:**
- `404 Not Found` - User not found
- `501 Not Implemented` - Billing feature not yet implemented
  ```json
  {
    "error": {
      "code": "NOT_IMPLEMENTED",
      "message": "Billing feature is not yet implemented"
    }
  }
  ```

---

**Next:** [Guilds](guilds.md) | [Back to README](README.md)
