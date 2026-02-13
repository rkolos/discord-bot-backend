/** Типы событий Discord, доступные для фильтрации и настройки blacklist в UI. */
export const ANALYTICS_EVENT_TYPES_FOR_UI = [
  'MESSAGE_CREATE',
  'MESSAGE_UPDATE',
  'MESSAGE_DELETE',
  'GUILD_MEMBER_ADD',
  'GUILD_MEMBER_REMOVE',
  'GUILD_MEMBER_UPDATE',
  'VOICE_STATE_UPDATE',
  'THREAD_CREATE',
  'GUILD_CREATE',
  'GUILD_DELETE',
  'PRESENCE_UPDATE',
] as const;

export type AnalyticsEventTypeForUi = (typeof ANALYTICS_EVENT_TYPES_FOR_UI)[number];
