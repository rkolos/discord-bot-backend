# Error Codes

Complete list of all error codes returned by the API.

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_CREDENTIALS` | 401 | Invalid email or password |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication token |
| `FORBIDDEN` | 403 | Insufficient permissions for this action |
| `USER_NOT_FOUND` | 404 | User with specified ID not found |
| `GUILD_NOT_FOUND` | 404 | Guild with specified ID not found |
| `SHARD_NOT_FOUND` | 404 | Shard with specified ID not found |
| `QUEUE_NOT_FOUND` | 404 | Queue with specified name not found |
| `VALIDATION_ERROR` | 400 | Request validation failed (check `details` field) |
| `USER_ALREADY_BANNED` | 400 | User is already banned |
| `USER_NOT_BANNED` | 400 | User is not banned |
| `BOT_NOT_IN_GUILD` | 400 | Bot is already not in guild |
| `SHARD_RESTARTING` | 400 | Shard is already restarting |
| `NOT_IMPLEMENTED` | 501 | Feature not yet implemented |
| `INTERNAL_ERROR` | 500 | Internal server error |

---

## Error Response Format

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

### Example Error Response

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User with id '550e8400-e29b-41d4-a716-446655440000' not found"
  }
}
```

---

**Next:** [Implementation Notes](implementation-notes.md) | [Back to README](README.md)
