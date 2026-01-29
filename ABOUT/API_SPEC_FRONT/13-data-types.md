# Data Types Reference

Complete reference of data types used throughout the API.

## Table of Contents

1. [Common Types](#151-common-types)
2. [Discord Snowflake IDs](#discord-snowflake-ids)
3. [Date Format](#152-date-format)
4. [Field Naming Convention](#153-field-naming-convention)

---

## 15.1 Common Types

### Discord Snowflake IDs

**Guild ID**, **User ID**, **Channel ID** and any other Discord Snowflake identifiers must be represented as **string** in all API requests and responses, never as number.

Discord Snowflakes are 64-bit integers. In JSON, if sent as a number, JavaScript and other runtimes may lose precision. Using string type ensures correct values on all clients. All path parameters (e.g. `:guildId`, `:userId`) and response fields that hold Discord IDs follow this rule; see e.g. `Guild.id`, `Widget.guildId`, path params in Guild, Analytics, Counter, and related endpoints.

### User
```typescript
interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}
```

### TeamMember
```typescript
interface TeamMember extends User {
  role: 'Owner' | 'Admin' | 'Member';
  joinedAt: string; // ISO 8601 date
}
```

### Guild
```typescript
interface Guild {
  id: string;
  name: string;
  icon?: string;
  status: 'active' | 'inactive' | 'error';
  memberCount: number;
  messageCount: number;
  lastActivity: string; // ISO 8601 date
  ownerId: string;
  subscriptionTier?: 'free' | 'pro' | 'enterprise';
  onlineMembers?: number;
  memberGrowth?: number;
  banner?: string;
}
```

### SubscriptionPlan
```typescript
interface SubscriptionPlan {
  id: 'free' | 'pro' | 'enterprise';
  name: string;
  price: number;
  pricePeriod: 'month' | 'year';
}
```

### UsageLimits
```typescript
interface UsageLimits {
  servers: { used: number; limit: number };
  members: { used: number; limit: number };
  messages: { used: number; limit: number };
}
```

### Invoice
```typescript
interface Invoice {
  id: string;
  amount: number;
  currency: string;
  date: string; // ISO 8601 date
  status: 'paid' | 'pending' | 'failed';
  downloadUrl?: string;
}
```

### ServerStats
```typescript
interface ServerStats {
  totalMembers: number;
  totalMessages: number;
  activeMembers: number;
  voiceMinutes: number;
}
```

### BotStatusInfo
```typescript
interface BotStatusInfo {
  status: 'online' | 'offline' | 'error';
  lastSeen?: string; // ISO 8601 date
  version?: string;
}
```

### AnalyticsData
```typescript
interface AnalyticsData {
  timeSeries: TimeSeriesData[];
  heatmap: HeatmapDataPoint[];
  summary: {
    totalMessages: number;
    totalMembers: number;
    totalVoiceMinutes: number;
    averageMessagesPerDay: number;
    averageMembersPerDay: number;
  };
  topChannels?: {
    messages: TopChannel[];
    voice: TopChannel[];
  };
  topMembers?: TopMember[];
  roleDistribution?: RoleDistribution[];
  topCommands?: CommandUsage[];
}
```

### Counter
```typescript
interface Counter {
  id: string;
  channelId: string;
  channelName: string;
  type: 'stat' | 'goal' | 'clock';
  metric?: 'members' | 'messages' | 'voice' | 'online';
  template: string;
  status: 'active' | 'inactive' | 'error';
  currentValue?: number;
  target?: number;
  timezone?: string; // IANA timezone format
  dateFormat?: string;
  createdAt: string; // ISO 8601 date
  updatedAt: string; // ISO 8601 date
}
```

### Widget
```typescript
interface Widget {
  id: string;
  guildId: string;
  name: string;
  config: WidgetConfig;
  embedUrl: string;
  embedCode: string;
  createdAt: string; // ISO 8601 date
  updatedAt: string; // ISO 8601 date
}
```

### ServerSettings
```typescript
interface ServerSettings {
  serverName: string;
  serverDescription?: string;
  language: string;
  timezone: string; // IANA timezone format
  botToken?: string; // Masked when returned
  botConnected: boolean;
  botUserId?: string;
  lastConnected?: string; // ISO 8601 date
  dataRetentionDays: number;
  anonymizeUserData: boolean;
  shareAnalytics: boolean;
  allowPublicWidgets: boolean;
}
```

---

## 15.2 Date Format

All dates in API responses and requests use ISO 8601 format:
- Full datetime: `2026-01-27T10:30:00Z`
- Date only: `2026-01-27`

---

## 15.3 Field Naming Convention

All JSON fields use `camelCase`:
- ✅ `memberCount`, `lastActivity`, `subscriptionTier`
- ❌ `member_count`, `last_activity`, `subscription_tier`

---

## Related Documentation

- [Introduction](./00-introduction.md)
- [Error Codes](./12-error-codes.md)
