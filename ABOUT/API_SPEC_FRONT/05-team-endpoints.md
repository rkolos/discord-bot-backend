# Team Endpoints

Team endpoints require authentication except GET /api/invites/:token (public).

## Table of Contents

1. [Team Members](#71-team-members)
2. [Invites (Public)](#72-invites-public)

---

## 7.1 Team Members

### 7.1.1 Get Team Members

**Endpoint:** `GET /api/me/team`

**Description:** Get list of team members in current user's workspace.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Query Parameters:**
- `page` (number, optional, default: 1) - Page number
- `limit` (number, optional, default: 20) - Items per page
- `search` (string, optional) - Search by name or email

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "email": "string",
      "avatar": "string",
      "role": "Owner" | "Admin" | "Member",
      "joinedAt": "string"
    }
  ],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### 7.1.2 Invite Team Member

**Endpoint:** `POST /api/me/team/invite`

**Description:** Create an invite link. Share the returned inviteUrl with the person to invite. No email required.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Request Body:**
```json
{
  "name": "string (optional)",
  "role": "Owner" | "Admin" | "Member"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "success": true,
    "inviteToken": "string",
    "inviteUrl": "string"
  }
}
```

**Error Responses:**
- `422 Unprocessable Entity` - Validation errors
- `403 Forbidden` - Insufficient permissions
  ```json
  {
    "error": {
      "code": "INSUFFICIENT_PERMISSIONS",
      "message": "Only Owners and Admins can invite team members"
    }
  }
  ```

### 7.1.3 Accept Team Invite

**Endpoint:** `POST /api/me/team/accept`

**Description:** Accept an invite for the current user. Requires Bearer JWT.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Request Body:**
```json
{
  "inviteToken": "string"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "companyId": "string",
    "companyName": "string"
  }
}
```

**Error Responses:**
- `404 Not Found` - INVITE_NOT_FOUND (invite not found or already used)
- `410 Gone` - INVITE_EXPIRED
- `409 Conflict` - ALREADY_TEAM_MEMBER (user already in the team)

### 7.1.4 Update Team Member Role

**Endpoint:** `PATCH /api/me/team/:memberId`

**Description:** Update team member's role.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `memberId` (string, required) - Team member ID

**Request Body:**
```json
{
  "role": "Owner" | "Admin" | "Member"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "id": "string",
    "name": "string",
    "email": "string",
    "avatar": "string",
    "role": "Owner" | "Admin" | "Member",
    "joinedAt": "string"
  }
}
```

**Error Responses:**
- `403 Forbidden` - Insufficient permissions
  ```json
  {
    "error": {
      "code": "INSUFFICIENT_PERMISSIONS",
      "message": "Only Owners can change roles"
    }
  }
  ```
- `404 Not Found` - Team member not found
  ```json
  {
    "error": {
      "code": "TEAM_MEMBER_NOT_FOUND",
      "message": "Team member not found"
    }
  }
  ```

### 7.1.5 Remove Team Member

**Endpoint:** `DELETE /api/me/team/:memberId`

**Description:** Remove team member from workspace.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `memberId` (string, required) - Team member ID

**Response:** `200 OK`
```json
{
  "data": {
    "success": true
  }
}
```

**Error Responses:**
- `403 Forbidden` - Insufficient permissions or cannot remove yourself
  ```json
  {
    "error": {
      "code": "INSUFFICIENT_PERMISSIONS",
      "message": "Cannot remove yourself or insufficient permissions"
    }
  }
  ```
- `404 Not Found` - Team member not found
  ```json
  {
    "error": {
      "code": "TEAM_MEMBER_NOT_FOUND",
      "message": "Team member not found"
    }
  }
  ```

---

## 7.2 Invites (Public)

### 7.2.1 Get Invite Preview

**Endpoint:** `GET /api/invites/:token`

**Description:** Get invite details for displaying accept UI. Public, no auth required.

**Path Parameters:**
- `token` (string, required) - Invite token from the invite URL

**Response:** `200 OK`
```json
{
  "data": {
    "companyName": "string",
    "inviterName": "string",
    "role": "Owner" | "Admin" | "Member"
  }
}
```

**Error Responses:**
- `404 Not Found` - INVITE_NOT_FOUND
- `410 Gone` - INVITE_EXPIRED

---

## Related Documentation

- [Introduction](./00-introduction.md)
- [Authentication](./01-authentication.md)
- [Error Codes](./12-error-codes.md)
- [Data Types Reference](./13-data-types.md)
