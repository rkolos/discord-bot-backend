# Authentication & Authorization

All authentication endpoints do not require authentication (except logout and refresh).

## Table of Contents

1. [Discord OAuth](#31-discord-oauth)
2. [Email/Password Authentication](#32-emailpassword-authentication)

---

## 3.1 Discord OAuth

### 3.1.1 Initiate Discord OAuth Flow

**Endpoint:** `GET /api/auth/discord`

**Description:** Initiates Discord OAuth flow. Frontend redirects user to this endpoint, which redirects to Discord OAuth.

**Query Parameters:**
- `redirect_uri` (string, optional) - Callback URL after OAuth completion

**Response:** HTTP 302 Redirect to Discord OAuth URL

**Example:**
```
GET /api/auth/discord?redirect_uri=https://server.ninja/dashboard
```

### 3.1.2 Discord OAuth Callback

**Endpoint:** `GET /api/auth/discord/callback`

**Description:** Callback endpoint called by Discord after OAuth authorization.

**Query Parameters:**
- `code` (string, required) - Authorization code from Discord
- `state` (string, optional) - State parameter for CSRF protection

**Response:** HTTP 302 Redirect to frontend with token in query or sets session cookie

**Success Response:**
- Redirects to frontend URL (e.g., `/dashboard?token=...`) or sets HTTP-only cookie

**Error Response:**
```json
{
  "error": {
    "code": "OAUTH_FAILED",
    "message": "Discord OAuth authentication failed"
  }
}
```

### 3.1.3 Verify Discord Token

**Endpoint:** `POST /api/auth/discord/verify`

**Description:** Verifies Discord OAuth token and returns JWT token.

**Request Body:**
```json
{
  "discordToken": "string"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "token": "jwt_token_here",
    "user": {
      "id": "string",
      "name": "string",
      "email": "string",
      "avatar": "string"
    }
  }
}
```

---

## 3.2 Email/Password Authentication

### 3.2.1 Register

**Endpoint:** `POST /api/auth/register`

**Description:** Register new user with email and password.

**Request Body:**
```json
{
  "fullName": "string",
  "email": "string",
  "password": "string"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "token": "jwt_token_here",
    "user": {
      "id": "string",
      "name": "string",
      "email": "string",
      "avatar": "string"
    }
  }
}
```

**Error Responses:**
- `422 Unprocessable Entity` - Validation errors
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Validation failed",
      "details": {
        "email": "Email already exists",
        "password": "Password must be at least 8 characters"
      }
    }
  }
  ```

### 3.2.2 Login

**Endpoint:** `POST /api/auth/login`

**Description:** Authenticate user with email and password.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "token": "jwt_token_here",
    "user": {
      "id": "string",
      "name": "string",
      "email": "string",
      "avatar": "string"
    }
  }
}
```

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

### 3.2.3 Logout

**Endpoint:** `POST /api/auth/logout`

**Description:** Logout current user and invalidate token.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Response:** `200 OK`
```json
{
  "data": {
    "success": true
  }
}
```

### 3.2.4 Refresh Token

**Endpoint:** `POST /api/auth/refresh`

**Description:** Rotate access/refresh token pair.

**Request:**
- Cookie: `refresh_token=<token>` (send with `credentials: 'include'`)

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

---

## Related Documentation

- [Introduction](./00-introduction.md)
- [Error Codes](./12-error-codes.md)
- [Data Types Reference](./13-data-types.md)
