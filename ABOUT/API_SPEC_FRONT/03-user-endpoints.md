# User Endpoints

All user endpoints require authentication.

## Table of Contents

1. [Current User](#51-current-user)

---

## 5.1 Current User

### 5.1.1 Get Current User

**Endpoint:** `GET /api/me`

**Description:** Get current authenticated user information.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Response:** `200 OK`
```json
{
  "data": {
    "id": "string",
    "name": "string",
    "email": "string",
    "avatar": "string"
  }
}
```

### 5.1.2 Update Current User

**Endpoint:** `PATCH /api/me`

**Description:** Update current user profile.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "avatar": "string"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "id": "string",
    "name": "string",
    "email": "string",
    "avatar": "string"
  }
}
```

---

## Related Documentation

- [Introduction](./00-introduction.md)
- [Authentication](./01-authentication.md)
- [Error Codes](./12-error-codes.md)
- [Data Types Reference](./13-data-types.md)
