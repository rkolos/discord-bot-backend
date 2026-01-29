# Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/login` | Authenticate admin | No |
| GET | `/api/auth/me` | Get current admin profile | Yes |
| POST | `/api/auth/logout` | Logout session | Yes |

---

## POST /api/auth/login

Authenticate admin user and receive access token.

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "secure_password"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "admin@example.com",
      "name": "Admin User",
      "avatarUrl": "https://cdn.discordapp.com/avatars/...",
      "role": "admin"
    }
  }
}
```
**Response Headers:**
- `Set-Cookie: refresh_token=<token>; HttpOnly; Secure; SameSite=Strict`

**Error Responses:**
- `401 Unauthorized` - Invalid credentials
  ```json
  {
    "error": {
      "code": "INVALID_CREDENTIALS",
      "message": "Invalid email or password"
    }
  }
  ```

---

## GET /api/auth/me

Get current authenticated admin user profile.

**Headers:**
- `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "email": "admin@example.com",
    "name": "Admin User",
    "avatarUrl": "https://cdn.discordapp.com/avatars/...",
    "role": "admin"
  }
}
```

**Notes:**
- This endpoint should be used to fetch admin user data for display in the admin header/navigation
- Returns current authenticated admin's profile information
- The AdminHeader component should call this endpoint to display: `name`, `avatarUrl`, and `role` in the user dropdown menu
- Currently, AdminHeader uses hardcoded data, but it should be updated to use this endpoint

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Token expired or insufficient permissions

---

## POST /api/auth/refresh

Rotate access/refresh token pair.

**Request:**
- Cookie: `refresh_token=<token>`

**Response:** `200 OK`
```json
{
  "data": {
    "accessToken": "new_access_token_here"
  }
}
```
**Response Headers:**
- `Set-Cookie: refresh_token=<new_token>; HttpOnly; Secure; SameSite=Strict`

**Error Responses:**
- `401 Unauthorized` - Missing, invalid, or revoked refresh token (cookie should be cleared)

---

## POST /api/auth/logout

Logout current session.

**Headers:**
- `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "data": {
    "success": true
  }
}
```

**Notes:**
- This endpoint is called from the "Log out" menu item in the AdminHeader dropdown menu
- Server must invalidate refresh token hash in the database and clear the refresh cookie
- After successful logout, the client should clear the stored access token and redirect to login page

---

**Next:** [Dashboard](dashboard.md) | [Back to README](README.md)
