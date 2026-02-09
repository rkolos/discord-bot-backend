# System Health Endpoints

## GET /api/system/health/summary

Get aggregated health status of the entire system for the main dashboard (API, Gateway, DB, optionally queues).

**Headers:**
- `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "data": {
    "api": "ok",
    "gateway": "ok",
    "database": "ok",
    "queues": "ok"
  }
}
```

**Notes:**
- One request to display overall system health on the main Admin screen.
- `api`: Status of Admin/Frontend API — `"ok" | "degraded" | "error"`.
- `gateway`: Status of Discord Gateway (shards); may include summary, e.g. count of online shards.
- `database`: Connection status to PostgreSQL — `"ok" | "error"`.
- `queues`: Optional summary of BullMQ queues — `"ok"` when no critical issues; `"degraded"` or `"error"` when there are failed jobs or overload.

---

## GET /api/system/shards

Get status of all Discord shards.

**Headers:**
- `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": 0,
      "status": "online",
      "ping": 120,
      "guildCount": 85,
      "uptimeSeconds": 604800
    },
    {
      "id": 1,
      "status": "online",
      "ping": 115,
      "guildCount": 82,
      "uptimeSeconds": 604800
    },
    {
      "id": 2,
      "status": "handshaking",
      "ping": 250,
      "guildCount": 0,
      "uptimeSeconds": 0
    }
  ]
}
```

**Notes:**
- `status`: `"online" | "handshaking" | "disconnected" | "error"`
- `ping`: Gateway latency in milliseconds (0 if shard is disconnected)
- `uptimeSeconds`: Shard uptime in seconds (0 if shard is not online)
- `guildCount`: Number of guilds assigned to this shard
- Response is an array of all shards, sorted by `id` in ascending order
- Each shard card displays: `id`, `status` (with color indicator), `ping`, `uptimeSeconds` (formatted), `guildCount`

**Response Type:** `IShardInfo[]` - See [IShardInfo](data-types.md#ishardinfo) in Data Types

---

## POST /api/system/shards/:id/restart

Restart a specific shard.

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id: number` - Shard ID

**Response:** `200 OK`
```json
{
  "data": {
    "success": true
  }
}
```

**Notes:**
- This action is triggered from the "Restart Shard" button in each ShardCard component
- The button shows loading state ("Restarting...") while the request is in progress

**Error Responses:**
- `404 Not Found` - Shard not found
- `400 Bad Request` - Shard is already restarting

---

## POST /api/system/guilds/:id/sync

Trigger manual sync of guild data (members, channels, roles) directly from Discord API, bypassing the event queue.

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `id: string` - Guild ID (internal uuid, same as in [guilds.md](guilds.md))

**Response:** `200 OK`
```json
{
  "data": {
    "success": true,
    "syncedAt": "2024-01-27T12:00:00.000Z"
  }
}
```

**Notes:**
- Use when automation has failed and an administrator needs to manually restore up-to-date guild state.
- Sync fetches current members, channels, and roles from Discord API and updates the database.

**Error Responses:**
- `404 Not Found` - Guild not found
- `409 Conflict` - Sync already in progress for this guild
- `503 Service Unavailable` - Discord API or sync service unavailable

---

## GET /api/system/queues

Get metrics for all job queues (BullMQ).

**Headers:**
- `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "data": [
    {
      "queueName": "workers-queue-counters-update",
      "active": 2,
      "waiting": 45,
      "delayed": 10,
      "failed": 0,
      "paused": false
    },
    {
      "queueName": "ingestor-raw-events",
      "active": 1,
      "waiting": 1250,
      "delayed": 0,
      "failed": 3,
      "paused": false
    },
    {
      "queueName": "workers-queue-welcome-goodbye-config",
      "active": 0,
      "waiting": 0,
      "delayed": 0,
      "failed": 0,
      "paused": false
    }
  ]
}
```

**Notes:**
- Response is an array of all queues with their current metrics
- `active`: Number of jobs currently being processed
- `waiting`: Number of jobs waiting in queue
- `delayed`: Number of jobs scheduled for future execution
- `failed`: Number of jobs that failed and require retry
- `paused`: Whether the queue is currently paused
- Each queue card displays visual representation (progress bars) and metrics for all four states
- "Retry Failed Jobs" button is enabled only when `failed > 0`

**Response Type:** `IQueueMetrics[]` - See [IQueueMetrics](data-types.md#iqueuemetrics) in Data Types

---

## GET /api/system/queues/stalled

Get list of stalled BullMQ jobs — jobs that were taken by workers but not completed (not acknowledged) within the configured stalled interval.

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `queueName?: string` - Filter by queue name (e.g., `"workers-queue-counters-update"`, `"ingestor-raw-events"`)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "jobId": "123",
      "queueName": "workers-queue-counters-update",
      "jobName": "updateCounter",
      "timestamp": "2024-01-27T12:00:00.000Z",
      "attempts": 2
    }
  ]
}
```

**Notes:**
- Stalled jobs are those that have been in "active" state longer than the queue's stalled interval (worker took the job but did not complete or fail it).
- Implementation may use BullMQ API for stalled jobs or equivalent (e.g., active jobs older than N seconds with no result).
- Use for monitoring and manual intervention when workers hang or crash without acknowledging.

**Response Type:** `IStalledJob[]` - See [IStalledJob](data-types.md#istalledjob) in Data Types

---

## POST /api/system/queues/:name/retry-failed

Retry all failed jobs in a specific queue.

**Headers:**
- `Authorization: Bearer <token>`

**Path Parameters:**
- `name: string` - Queue name (e.g., `"workers-queue-counters-update"`, `"ingestor-raw-events"`)

**Response:** `200 OK`
```json
{
  "data": {
    "success": true,
    "retriedCount": 5
  }
}
```

**Notes:**
- This action is triggered from the "Retry Failed Jobs" button in each QueuesMetricsCard component
- The button is only enabled when `failed > 0` for that queue
- The button shows loading state ("Retrying...") while the request is in progress
- `retriedCount` indicates how many failed jobs were retried
- This action moves all failed jobs back to the waiting queue for reprocessing

**Error Responses:**
- `404 Not Found` - Queue not found

---

## POST /api/system/maintenance/mode

Enable or disable maintenance mode. When enabled, write operations to the database are blocked (or deferred) to allow migrations or maintenance work.

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "enabled": true,
  "reason": "Applying PostgreSQL migrations"
}
```

- `enabled: boolean` - Whether to turn maintenance mode on or off
- `reason?: string` - Optional reason for maintenance (for logging/audit)

**Response:** `200 OK`
```json
{
  "data": {
    "maintenanceMode": true
  }
}
```

**Notes:**
- When maintenance mode is on: write operations to the database may be rejected or deferred (e.g., queued for later); exact behavior is implementation-defined (e.g., block all writes or only non-critical tables).
- Read operations and critical auth flows (login, token refresh) may remain allowed so that the system stays usable for viewing and authentication during maintenance.
- Use before running migrations or technical work; disable after work is complete.

**Response Type:** `IMaintenanceModeResponse` - See [IMaintenanceModeResponse](data-types.md#imaintenancemoderesponse) in Data Types

---

## POST /api/system/cleanup/orphans

Run a manual check for orphaned records (e.g. counters or widgets referencing non-existent guilds; inactive guilds with stale jobs in queues) and clean them up.

**Headers:**
- `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "data": {
    "success": true,
    "countersRemoved": 2,
    "widgetsRemoved": 0,
    "jobsRemoved": 5
  }
}
```

- `countersRemoved`: number of orphaned counter records removed from PostgreSQL
- `widgetsRemoved`: number of orphaned widget records removed from PostgreSQL
- `jobsRemoved`: number of BullMQ jobs (e.g. for removed counters) annulled/removed from queues

**Notes:**
- Use for admin-driven recovery of consistency when orphaned data is suspected.
- Cleanup applies to PostgreSQL and to annulling corresponding jobs in BullMQ. Data in ClickHouse is not cascade-deleted; orphaned analytics data remains until TTL (see spec on ClickHouse).
- May be run during maintenance mode or with caution under high load, depending on implementation.

---

## GET /api/system/logs

Get system logs with cursor-based pagination.

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `limit?: number` - Number of logs to return (default: `50`, max: `500`)
- `cursor?: string` - ISO timestamp cursor for pagination (e.g., `"2024-01-27T12:00:00.000Z"`)
- `level?: string` - Filter by log level: `"info" | "warn" | "error" | "debug" | "all"` (default: `"all"`)
- `service?: string` - Filter by service name (e.g., `"gateway"`, `"api"`, `"worker"`)

**Example Request:**
```
GET /api/system/logs?limit=100&level=error&service=gateway&cursor=2024-01-27T12:00:00.000Z
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "timestamp": "2024-01-27T12:00:00.000Z",
      "level": "error",
      "message": "Failed to connect to database",
      "service": "api"
    },
    {
      "timestamp": "2024-01-27T11:59:00.000Z",
      "level": "warn",
      "message": "High memory usage detected: 850MB",
      "service": "worker"
    }
  ],
  "meta": {
    "cursor": "2024-01-27T11:59:00.000Z",
    "hasMore": true
  }
}
```

**Notes:**
- Uses cursor-based pagination for infinite logs
- `cursor` should be the `timestamp` of the last log entry from previous request
- `hasMore: false` indicates no more logs available
- Logs are returned in descending order (newest first)
- `level` filter: When specified, only logs with matching level are returned (server-side filtering)
- `service` filter: When specified, only logs from matching service are returned (server-side filtering)
- Each log entry displays: `timestamp` (formatted time), `level` (with color coding), `service`, `message`
- Logs Console component also supports client-side filtering by message text (not a server parameter)
- Note: "Clear Console" button and "Auto-scroll" checkbox are local UI actions and do not require API endpoints

**Response Type:** `ILogEntry[]` with meta - See [ILogEntry](data-types.md#ilogentry) in Data Types

---

**Next:** [Data Types](data-types.md) | [Back to README](README.md)
