/** Внутреннее представление события для буфера и записи в raw_events. */
export interface RawEvent {
  eventId: string;
  eventTime: Date | string;
  eventType: string;
  guildId: string;
  discordGuildId: string;
  userId?: string | null;
  discordUserId?: string | null;
  channelId?: string | null;
  roleId?: string | null;
  commandName?: string | null;
  planTier: string;
  isBotGenerated: boolean;
  payload: string;
  isHistorical?: boolean;
}
