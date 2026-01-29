# API Specification

> **Server.Ninja Admin Panel API Contract**  
> Version: 1.0.0  
> Base URL: `https://api.server.ninja` (configurable via `NEXT_PUBLIC_API_URL`)

## Table of Contents

1. [Introduction](00-introduction.md) - General Information, Response Format, Error Handling
2. [Authentication](auth.md) - Auth endpoints (login, me, logout)
3. [Dashboard](dashboard.md) - Dashboard overview statistics
4. [Analytics](analytics.md) - Analytics endpoints (counters, widgets, growth, commands, leaderboards)
5. [Users](users.md) - User management endpoints
6. [Guilds](guilds.md) - Guild management endpoints
7. [System Health](system-health.md) - System monitoring endpoints (shards, queues, logs)
8. [Data Types](data-types.md) - All TypeScript types, enums, and interfaces
9. [Error Codes](error-codes.md) - Complete list of error codes
10. [Implementation Notes](implementation-notes.md) - Notes for backend developers

---

## Quick Reference

### Endpoints Overview

| Category | Endpoints | File |
|----------|-----------|------|
| **Auth** | `POST /api/auth/login`<br>`GET /api/auth/me`<br>`POST /api/auth/logout` | [auth.md](auth.md) |
| **Dashboard** | `GET /api/dashboard/overview` | [dashboard.md](dashboard.md) |
| **Analytics** | `GET /api/analytics/counters`<br>`GET /api/analytics/widgets`<br>`GET /api/analytics/growth`<br>`GET /api/analytics/commands`<br>`GET /api/analytics/leaderboards` | [analytics.md](analytics.md) |
| **Users** | `GET /api/users`<br>`GET /api/users/:id`<br>`POST /api/users/:id/ban`<br>`POST /api/users/:id/unban`<br>`POST /api/users/:id/impersonate`<br>`GET /api/users/:id/billing` | [users.md](users.md) |
| **Guilds** | `GET /api/guilds`<br>`GET /api/guilds/:id`<br>`DELETE /api/guilds/:id` | [guilds.md](guilds.md) |
| **System Health** | `GET /api/system/shards`<br>`POST /api/system/shards/:id/restart`<br>`GET /api/system/queues`<br>`POST /api/system/queues/:name/retry-failed`<br>`GET /api/system/logs` | [system-health.md](system-health.md) |

---

## Getting Started

1. Start with [Introduction](00-introduction.md) to understand the API structure and conventions
2. Review [Data Types](data-types.md) to understand all available types
3. Check [Error Codes](error-codes.md) for error handling
4. Refer to specific endpoint files for detailed documentation

---

**Last Updated:** 2024-01-27
