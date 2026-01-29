# API Specification Documentation

**Version:** 1.0  
**Last Updated:** 2026-01-27

This directory contains the complete API specification, organized into logical groups for easier navigation and maintenance.

## Documentation Structure

### Core Documentation

1. **[Introduction](./00-introduction.md)** - General principles, response standardization, and API overview
2. **[Authentication & Authorization](./01-authentication.md)** - Discord OAuth and email/password authentication

### Endpoint Groups

3. **[Public Endpoints](./02-public-endpoints.md)** - Public endpoints (features, pricing, documentation, stats)
4. **[User Endpoints](./03-user-endpoints.md)** - Current user profile management
5. **[Guild Endpoints](./04-guild-endpoints.md)** - Discord server (guild) management and statistics
6. **[Team Endpoints](./05-team-endpoints.md)** - Team member management and workspace collaboration
7. **[Billing Endpoints](./06-billing-endpoints.md)** - Subscription, usage limits, and invoices
8. **[Analytics Endpoints](./07-analytics-endpoints.md)** - Analytics data and heatmaps for guilds
9. **[Leaderboard Endpoints](./08-leaderboard-endpoints.md)** - Leaderboard data for guilds
10. **[Counter Endpoints](./09-counter-endpoints.md)** - Counter management (stat, goal, clock)
11. **[Widget Endpoints](./10-widget-endpoints.md)** - Widget creation and management
12. **[Settings Endpoints](./11-settings-endpoints.md)** - Server settings configuration

### Reference Documentation

13. **[Error Codes](./12-error-codes.md)** - Complete list of error codes
14. **[Data Types Reference](./13-data-types.md)** - TypeScript interfaces and data type definitions

## Quick Start

1. Start with [Introduction](./00-introduction.md) to understand API principles and response formats
2. Review [Authentication](./01-authentication.md) to learn how to authenticate requests
3. Browse endpoint groups based on your needs
4. Refer to [Error Codes](./12-error-codes.md) and [Data Types](./13-data-types.md) as needed

## Base URL

Configurable via environment variables (e.g., `NEXT_PUBLIC_API_URL`). Default: `/api`

## Authentication

Most endpoints require authentication using Bearer Token (JWT) in the `Authorization` header:
```
Authorization: Bearer <token>
```

## Response Format

All responses follow the envelope pattern:
- Success: `{ "data": {...} }`
- Error: `{ "error": { "code": "...", "message": "..." } }`

See [Introduction](./00-introduction.md) for details.

---

**Note:** This specification is split into multiple files for better organization. All information from the original specification is preserved in these documents.
