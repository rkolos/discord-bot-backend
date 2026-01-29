# Error Codes

Complete list of error codes used throughout the API.

## Table of Contents

1. [Authentication Errors](#authentication-errors)
2. [Authorization Errors](#authorization-errors)
3. [Validation Errors](#validation-errors)
4. [Resource Not Found Errors](#resource-not-found-errors)
5. [Business Logic Errors](#business-logic-errors)
6. [Server Errors](#server-errors)

---

## Authentication Errors

- `INVALID_CREDENTIALS` - Invalid email or password
- `TOKEN_EXPIRED` - JWT token has expired
- `TOKEN_INVALID` - JWT token is invalid or malformed
- `OAUTH_FAILED` - Discord OAuth authentication failed
- `DISCORD_TOKEN_EXPIRED` - Discord token expired or missing; re-login required to refresh guild list
- `UNAUTHORIZED` - Authentication required

---

## Authorization Errors

- `INSUFFICIENT_PERMISSIONS` - User doesn't have required permissions
- `FORBIDDEN` - Access denied

---

## Validation Errors

- `VALIDATION_ERROR` - Request validation failed (see `details` for field-specific errors)
- `INVALID_DATE_RANGE` - Invalid date range in query parameters
- `INVALID_SORT_PARAMETER` - Invalid sort parameter value

---

## Resource Not Found Errors

- `USER_NOT_FOUND` - User not found
- `GUILD_NOT_FOUND` - Guild not found or access denied
- `TEAM_MEMBER_NOT_FOUND` - Team member not found
- `COUNTER_NOT_FOUND` - Counter not found
- `WIDGET_NOT_FOUND` - Widget not found
- `INVOICE_NOT_FOUND` - Invoice not found
- `DOC_ARTICLE_NOT_FOUND` - Documentation article not found

---

## Business Logic Errors

- `SUBSCRIPTION_UPGRADE_FAILED` - Failed to upgrade subscription
- `RATE_LIMIT_EXCEEDED` - Rate limit exceeded

---

## Server Errors

- `INTERNAL_SERVER_ERROR` - Internal server error
- `SERVICE_UNAVAILABLE` - Service temporarily unavailable

---

## Related Documentation

- [Introduction](./00-introduction.md)
- [Authentication](./01-authentication.md)
- [Data Types Reference](./13-data-types.md)
