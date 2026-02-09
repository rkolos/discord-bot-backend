/**
 * Payload события Discord для Redis Pub/Sub и WebSocket.
 * Полные данные события в формате, близком к Discord API.
 */
export interface DiscordEventPayload {
  /** Внутренний UUID гильдии. */
  guildId: string;
  /** Discord Snowflake ID гильдии. */
  discordGuildId: string;
  /** Тип события (Gateway style): MESSAGE_CREATE, GUILD_MEMBER_ADD и т.д. */
  eventType: string;
  /** Тело события (сериализуемый объект, совместимый с Discord API). */
  data: Record<string, unknown>;
  /** Время события (ISO 8601). */
  timestamp?: string;
}
