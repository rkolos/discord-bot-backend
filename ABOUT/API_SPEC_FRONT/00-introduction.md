# API Contract Specification - Introduction

**Version:** 1.0  
**Last Updated:** 2026-01-27  
**Base URL:** Configurable via environment variables (default: `/api`)

## Table of Contents

1. [Introduction](#1-introduction)
2. [Response Standardization (Envelope Pattern)](#2-response-standardization-envelope-pattern)

---

## 1. Introduction

### 1.1 General Principles

- **Base URL:** Configurable via environment variables (e.g., `NEXT_PUBLIC_API_URL`). Default: `/api`
- **Authentication:** Bearer Token (JWT) in `Authorization` header: `Authorization: Bearer <token>`
- **Content-Type:** All requests and responses use `application/json`
- **Date Format:** ISO 8601 (e.g., `2026-01-27T10:30:00Z`)
- **Field Naming:** All JSON fields use `camelCase`
- **HTTP Methods:**
  - `GET` - Read data
  - `POST` - Create resources or perform actions
  - `PATCH` - Partial update
  - `DELETE` - Delete resources

### 1.2 Rate Limiting

Rate limiting may be applied. When rate limit is exceeded, API returns `429 Too Many Requests` with retry information in headers.

---

## 2. Response Standardization (Envelope Pattern)

### 2.1 Success Responses

#### Single Object Response
```json
{
  "data": {
    // Object data here
  }
}
```

#### List Response (without pagination)
```json
{
  "data": [
    // Array of objects
  ]
}
```

#### List Response (with pagination)
```json
{
  "data": [
    // Array of objects
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### 2.2 Error Responses

All error responses follow this structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Optional additional error details
    }
  }
}
```

**HTTP Status Codes:**
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `422 Unprocessable Entity` - Validation errors
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

See [Error Codes](./12-error-codes.md) section for complete list of error codes.

---

## Appendix A: Definition of Done Checklist

- [x] **Coverage:** For every button and every table in the mockup, there is a corresponding Endpoint in the specification
- [x] **HTTP Methods:** Semantically correct methods are used (GET for reading, POST for creating/actions, DELETE for deletion, PATCH/PUT for updates)
- [x] **Query Params:** For all lists, parameters `page`, `limit`, and `search` are explicitly documented
- [x] **Field Types:** Clearly specified where `string` (ISO Date) is expected, where `number` (Timestamp), and where `boolean`
- [x] **Errors:** Defined list of standard error codes (401 Unauthorized, 403 Forbidden, 404 Not Found, etc.)
- [x] **Consistency:** Field names are consistent throughout (preferably `camelCase` for JSON)

---

## Related Documentation

- [Authentication & Authorization](./01-authentication.md)
- [Public Endpoints](./02-public-endpoints.md)
- [User Endpoints](./03-user-endpoints.md)
- [Guild Endpoints](./04-guild-endpoints.md)
- [Team Endpoints](./05-team-endpoints.md)
- [Billing Endpoints](./06-billing-endpoints.md)
- [Analytics Endpoints](./07-analytics-endpoints.md)
- [Leaderboard Endpoints](./08-leaderboard-endpoints.md)
- [Counter Endpoints](./09-counter-endpoints.md)
- [Widget Endpoints](./10-widget-endpoints.md)
- [Settings Endpoints](./11-settings-endpoints.md)
- [Error Codes](./12-error-codes.md)
- [Data Types Reference](./13-data-types.md)
