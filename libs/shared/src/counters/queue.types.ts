/** Имя очереди (BullMQ не допускает ":" в имени). Полный ключ Redis: sn:{env}:workers-queue-counters-update */
export const COUNTERS_UPDATE_QUEUE_NAME = 'workers-queue-counters-update';

export interface CounterUpdateJobPayload {
  counter_id: string;
  guild_id: string;
  channel_id: string;
  type: string;
  metric?: string | null;
}
