/**
 * Единый формат события состояния гильдии для Redis Pub/Sub и WebSocket.
 * Используется frontend-api, ingestor-worker и bot-service.
 */
export interface GuildStateEventPayload {
  /** Внутренний UUID гильдии. */
  guildId: string;
  /** Discord Snowflake ID гильдии. */
  discordGuildId: string;
  /** Имя параметра. */
  parameter: GuildStateParameter;
  /** Направление изменения. */
  direction: 'set' | 'inc' | 'dec';
  /** На сколько изменилось (для inc/dec). */
  delta?: number;
  /** Новое значение (для set — полное значение параметра; для inc/dec — итог после изменения). Для отображения на фронте достаточно использовать value без накопления по delta. */
  value?: string | number | boolean | Record<string, unknown> | null;
  /** Время события (ISO 8601). */
  timestamp?: string;
}

export type GuildStateParameter =
  | 'historySyncStatus'
  | 'memberCount'
  | 'onlineMembers'
  | 'totalMessages'
  | 'threadCreated'
  | 'lastActivity'
  | 'bot_status'
  | 'isBotInGuild'
  | 'guildInfo'
  | 'botConnected'
  | 'lastSyncAt'
  | 'voiceOnline';
