/** Типы событий Discord, обрабатываемые Ingestor Worker. */
export const INGESTOR_EVENT_TYPES = [
  'MESSAGE_CREATE',
  'VOICE_STATE_UPDATE',
  'voice_change',
  'INTERACTION_CREATE',
  'GUILD_MEMBER_ADD',
  'GUILD_MEMBER_REMOVE',
] as const;

export type IngestorEventType = (typeof INGESTOR_EVENT_TYPES)[number];

export const PLAN_TIERS = ['free', 'premium', 'pro', 'enterprise'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];
