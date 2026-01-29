# Introduction

## General Information

### Base URL

All API requests should be made to the base URL configured via environment variable `NEXT_PUBLIC_API_URL`. Default: `https://api.server.ninja`

### API Versioning

Currently, the API does not use versioning. All endpoints are under `/api/*` prefix.

### Content Type

All requests and responses use `application/json` content type.

### Authentication

Most endpoints require authentication via Bearer Token in the `Authorization` header:

```
Authorization: Bearer <JWT_TOKEN>
```

---

## Response Format

### Envelope Pattern

All successful API responses follow the **Envelope Pattern**:

#### Single Object Response
```json
{
  "data": <T>
}
```

#### Paginated List Response
```json
{
  "data": <T[]>,
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

### Error Response Format

All error responses follow this structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} // Optional additional error details
  }
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200 OK` | Successful request |
| `201 Created` | Resource created successfully |
| `400 Bad Request` | Invalid request parameters |
| `401 Unauthorized` | Authentication required or invalid |
| `403 Forbidden` | Insufficient permissions |
| `404 Not Found` | Resource not found |
| `500 Internal Server Error` | Server error |

### Error Codes

See [Error Codes](error-codes.md) section for complete list.

---

**Next:** [Authentication](auth.md)
