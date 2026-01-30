/** Имя очереди (должно совпадать с ingestor-worker INGESTOR_RAW_EVENTS_QUEUE_NAME). */
export const INGESTOR_RAW_EVENTS_QUEUE_NAME = 'ingestor-raw-events';

/**
 * Payload для очереди ingestor-raw-events. Должен совпадать с IngestorJobPayload в ingestor-worker.
 */
export interface RawEventJobPayload {
  eventId: string;
  eventType: string;
  eventTime: string;
  guildId: string;
  discordGuildId: string;
  userId?: string | null;
  discordUserId?: string | null;
  channelId?: string | null;
  planTier?: string | null;
  payload?: Record<string, unknown> | null;
  roleId?: string | null;
  commandName?: string | null;
  isBotGenerated?: boolean;
}
