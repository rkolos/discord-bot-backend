# Data Types

This document contains all TypeScript types, enums, and interfaces used in the API.

---

## Enums

### UserStatus
```typescript
type UserStatus = 'active' | 'banned';
```

### UserPlan
```typescript
type UserPlan = 'free' | 'pro' | 'enterprise';
```

### CounterType
```typescript
type CounterType = 
  | 'members_total'
  | 'members_online'
  | 'boost_count'
  | 'voice_connected'
  | 'game_activity';
```

### LogLevel
```typescript
type LogLevel = 'info' | 'warn' | 'error' | 'debug';
```

### ShardState
```typescript
type ShardState = 'online' | 'handshaking' | 'disconnected' | 'error';
```

### SystemStatus
```typescript
type SystemStatus = 'healthy' | 'degraded' | 'down';
```

---

## Interfaces

### IAdminUser
```typescript
interface IAdminUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: 'admin' | 'super_admin';
}
```

### IAuthResponse
```typescript
interface IAuthResponse {
  user: IAdminUser;
  accessToken: string;
}
```

### IUser
```typescript
interface IUser {
  id: string;              // Internal ID (UUID)
  discordId: string;       // Discord Snowflake ID
  username: string;
  discriminator: string;
  avatarUrl: string;
  email?: string;
  plan: UserPlan;
  status: UserStatus;
  createdAt: string;       // ISO Date
  lastLoginAt: string;     // ISO Date
  ownedGuildsCount: number;
}
```

### IUserDetail
```typescript
interface IUserDetail extends IUser {
  activityLog: IActivityLogEntry[];
  balance?: number;
  ownedGuilds?: IGuild[];
}
```

### IGuild
```typescript
interface IGuild {
  id: string;
  discordGuildId: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
  memberCount: number;
  shardId: number;
  isBotInGuild: boolean;
  activeCountersCount: number;
  widgetsCreatedCount: number;
  joinedAt: string;        // ISO Date
  historySyncStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
}
```

### IGuildDetail
```typescript
interface IGuildDetail extends IGuild {
  config: Record<string, any>;
  stats: IGuildStats;
  isPremium?: boolean;
  isVerified?: boolean;
}
```

### PaginationMeta
```typescript
interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;  // true when page < totalPages
}
```

### ApiError
```typescript
interface ApiError {
  code: string;            // Machine-readable code
  message: string;         // Human-readable message
  details?: any;           // Optional additional details
}
```

### IActivityLogEntry
```typescript
interface IActivityLogEntry {
  id: string;
  action: string;
  timestamp: string;       // ISO Date
  details?: string;         // Optional additional details
}
```

### IGuildStats
```typescript
interface IGuildStats {
  messageActivity: {
    date: string;          // ISO Date (YYYY-MM-DD format)
    count: number;
  }[];
  ticketVolume?: {         // Optional
    date: string;          // ISO Date (YYYY-MM-DD format)
    count: number;
  }[];
}
```

### ITimeSeriesPoint
```typescript
interface ITimeSeriesPoint {
  date: string;            // ISO Date (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss format)
  value: number;           // Main metric (e.g., Active Users, Views)
  value2?: number;         // Secondary metric (e.g., Churn, Clicks)
}
```

### TimeSeriesData
```typescript
type TimeSeriesData = ITimeSeriesPoint[];
```

### ICounterStat
```typescript
interface ICounterStat {
  type: CounterType;
  count: number;           // Total count of this counter type
  percentage: number;      // Percentage of total (0-100)
  popularTemplate: string; // Most popular template string
}
```

### ITopTemplate
```typescript
interface ITopTemplate {
  template: string;        // Template string (e.g., "👥 Members: {count}")
  usageCount: number;      // Number of times this template is used
}
```

### ICommandMetric
```typescript
interface ICommandMetric {
  commandName: string;     // e.g., "setup", "stats"
  category: string;        // e.g., "Setup", "Analytics"
  executionCount: number;  // Total number of executions
  errorCount: number;      // Number of failed executions
  errorRate: number;      // Error rate percentage (0-100)
  avgLatency: number;      // Average latency in milliseconds
}
```

### IShardInfo
```typescript
interface IShardInfo {
  id: number;              // Shard ID (0-based)
  status: ShardState;      // Current shard status
  ping: number;            // Gateway latency in milliseconds (0 if disconnected)
  guildCount: number;     // Number of guilds on this shard
  uptimeSeconds: number;   // Shard uptime in seconds
}
```

### IQueueMetrics
```typescript
interface IQueueMetrics {
  queueName: string;       // Queue identifier (e.g., "analytics-queue")
  active: number;          // Currently processing jobs
  waiting: number;         // Pending jobs
  delayed: number;         // Scheduled for future execution
  failed: number;          // Failed jobs (requires retry)
  paused: boolean;         // Whether queue is paused
}
```

### IStalledJob
```typescript
interface IStalledJob {
  jobId: string;           // BullMQ job ID
  queueName: string;       // Queue name
  jobName: string;         // Job type/name
  timestamp: string;       // ISO Date — when job was taken or last activity
  attempts: number;        // Number of attempts
}
```

### IMaintenanceModeResponse
```typescript
interface IMaintenanceModeResponse {
  maintenanceMode: boolean; // Current maintenance mode state
}
```

### ILogEntry
```typescript
interface ILogEntry {
  timestamp: string;       // ISO Date (ISO 8601 format)
  level: LogLevel;         // Log severity level
  message: string;         // Log message
  service: string;         // Service name (e.g., "gateway", "api", "worker")
}
```

### IGrowthSource
```typescript
interface IGrowthSource {
  source: string;          // Installation source name (e.g., "App Directory", "Website")
  installs: number;       // Number of installations from this source
  percentage: number;      // Percentage of total installations (0-100)
}
```

### IInviteLeaderboardEntry
```typescript
interface IInviteLeaderboardEntry {
  userId: string;         // User UUID
  username: string;       // Discord username
  avatarUrl: string;      // Full URL to avatar
  invitesCount: number;   // Number of guilds that added bot via this user's invite
  retentionRate?: number; // Percentage of servers that didn't kick the bot (0-100, optional)
}
```

### IGuildLeaderboardEntry
```typescript
interface IGuildLeaderboardEntry {
  id: string;             // Guild UUID
  name: string;           // Guild name
  iconUrl: string | null; // Guild icon URL or null
  memberCount: number;    // Total member count
  ownerName: string;      // Username of the guild owner
  plan: UserPlan;         // Subscription plan of the guild owner
}
```

### ICounterStatsResponse
```typescript
interface ICounterStatsResponse {
  distribution: ICounterStat[];  // Distribution by counter type
  topTemplates: ITopTemplate[];  // Top templates (typically top 10)
  totalActive: number;           // Total number of active counters
  avgPerGuild: number;           // Average counters per guild
}
```

### IGrowthStatsResponse
```typescript
interface IGrowthStatsResponse {
  sources: IGrowthSource[];              // Installation sources distribution
  leaderboard: IInviteLeaderboardEntry[]; // Top inviters leaderboard
  totalInstalls: number;                  // Total number of installations
}
```

### IDashboardStats
```typescript
interface IDashboardStats {
  activeUsers: {
    current: number;
    trend: number;         // Percentage change vs last period
  };
  totalGuilds: {
    current: number;
    trend: number;
  };
  totalCounters: {
    current: number;
    trend: number;
  };
  mrr: {
    current: number;
    currency: string;
  };
  growthData: TimeSeriesData;     // Growth trend data for last 30 days
  featureLeaderboard: ICounterStat[]; // Top 3 counter types
  systemStatus: {
    api: SystemStatus;
    gateway: SystemStatus;
    database: SystemStatus;
  };
}
```

### IWidgetStats
```typescript
interface IWidgetStats {
  totalViews: number;     // Total widget views
  totalClicks: number;    // Total widget clicks
  ctr: number;            // Click-through rate percentage
  timeSeries: TimeSeriesData; // Views/Clicks time series data
  topReferrers: {
    domain: string;       // Referrer domain
    views: number;        // Views from this referrer
    clicks: number;       // Clicks from this referrer
  }[];
}
```

---

**Next:** [Error Codes](error-codes.md) | [Back to README](README.md)
