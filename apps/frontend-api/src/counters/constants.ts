import { CounterMetric, CounterType } from '@app/shared';

/**
 * Маппинг "типов счётчиков" для бота (members_all, members_online, …)
 * на пару (CounterType, CounterMetric) для API и БД.
 */
export const DISPLAY_TYPE_TO_API: Record<
  string,
  { type: CounterType; metric: CounterMetric | null }
> = {
  members_all: { type: CounterType.STAT, metric: CounterMetric.MEMBERS },
  members_online: { type: CounterType.STAT, metric: CounterMetric.ONLINE },
  members_bots: { type: CounterType.STAT, metric: CounterMetric.BOTS },
  date_now: { type: CounterType.CLOCK, metric: null },
};
