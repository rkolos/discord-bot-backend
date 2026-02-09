import { COUNTERS_UPDATE_QUEUE_NAME } from '../queues/queue-names.constants';

// Реэкспорт константы для обратной совместимости
export { COUNTERS_UPDATE_QUEUE_NAME };

export interface CounterUpdateJobPayload {
  counter_id: string;
  guild_id: string;
  channel_id: string;
  type: string;
  metric?: string | null;
  role_id?: string | null;
}
