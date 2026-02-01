/** Имя очереди (BullMQ). Полный ключ Redis: sn:{env}:workers-queue-history-sync */
export const HISTORY_SYNC_QUEUE_NAME = 'workers-queue-history-sync';

export interface HistorySyncJobPayload {
  guildId: string;
  discordGuildId: string;
}
