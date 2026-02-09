import { HISTORY_SYNC_QUEUE_NAME } from '../queues/queue-names.constants';

// Реэкспорт константы для обратной совместимости
export { HISTORY_SYNC_QUEUE_NAME };

export interface HistorySyncJobPayload {
  guildId: string;
  discordGuildId: string;
}
