/** Типы событий Discord, обрабатываемые Ingestor Worker. */
export const INGESTOR_EVENT_TYPES = [
  'MESSAGE_CREATE',
  'MESSAGE_UPDATE',
  'MESSAGE_DELETE',
  'VOICE_STATE_UPDATE',
  'voice_change',
  'INTERACTION_CREATE',
  'GUILD_MEMBER_ADD',
  'GUILD_MEMBER_REMOVE',
  'GUILD_MEMBER_UPDATE',
  'THREAD_CREATE',
  'GUILD_CREATE',
  'GUILD_DELETE',
  'PRESENCE_UPDATE',
] as const;

export type IngestorEventType = (typeof INGESTOR_EVENT_TYPES)[number];

/** По умолчанию не писать в ClickHouse (если у гильдии null/пустой blacklist). */
export const DEFAULT_ANALYTICS_EVENT_TYPES_BLACKLIST: string[] = ['PRESENCE_UPDATE'];

export const PLAN_TIERS = ['free', 'premium', 'pro', 'enterprise'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];
