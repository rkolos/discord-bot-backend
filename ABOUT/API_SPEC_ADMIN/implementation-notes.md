# Implementation Notes

Notes and guidelines for backend developers implementing this API.

---

## 1. Date Formats

All dates should be in ISO 8601 format (e.g., `"2024-01-27T12:00:00.000Z"`)

---

## 2. Pagination

- Default `limit` should be `10` for lists
- Maximum `limit` should be `100` to prevent performance issues
- `totalPages` should be calculated as `Math.ceil(total / limit)`

---

## 3. Search

- Search should be case-insensitive
- For users: search in `username`, `email`, `discordId`
- For guilds: search in `name`, `discordGuildId`

---

## 4. Sorting

- Default sort order should be descending (`desc`) for most lists
- Support multiple sort fields as specified in each endpoint documentation

---

## 5. Trends Calculation

- Trends (percentages) should be calculated on backend
- Compare current period with previous period (e.g., last 30 days vs previous 30 days)

---

## 6. Authentication

- JWT tokens should have expiration time (recommended: 24 hours)
- Token should be validated on every protected endpoint

---

## 7. Rate Limiting

- Consider implementing rate limiting for API endpoints
- Recommended: 100 requests per minute per IP/token

---

## 8. CORS

- Configure CORS to allow requests from admin panel domain only

---

## Example Request/Response Flow

### Example: Get Users List

**Request:**
```http
GET /api/users?page=1&limit=20&search=john&status=active HTTP/1.1
Host: api.server.ninja
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "discordId": "123456789012345678",
      "username": "john_doe",
      "discriminator": "1234",
      "avatarUrl": "https://cdn.discordapp.com/avatars/123456789012345678/abc123.png",
      "email": "john@example.com",
      "plan": "pro",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLoginAt": "2024-01-27T12:00:00.000Z",
      "ownedGuildsCount": 3
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

**Back to [README](README.md)**
