import { CounterMetric, CounterType } from '@app/shared';

/**
 * Маппинг "типов счётчиков" для бота (members_all, members_online, …)
 * на пару (CounterType, CounterMetric) для API и БД.
 * Счётчики по роли: metric=role и roleId (Discord role ID) задаются отдельно в API.
 */
export const DISPLAY_TYPE_TO_API: Record<
  string,
  { type: CounterType; metric: CounterMetric | null }
> = {
  members_all: { type: CounterType.STAT, metric: CounterMetric.MEMBERS },
  members_online: { type: CounterType.STAT, metric: CounterMetric.ONLINE },
  members_idle: { type: CounterType.STAT, metric: CounterMetric.IDLE },
  members_dnd: { type: CounterType.STAT, metric: CounterMetric.DND },
  members_offline: { type: CounterType.STAT, metric: CounterMetric.OFFLINE },
  members_bots: { type: CounterType.STAT, metric: CounterMetric.BOTS },
  date_now: { type: CounterType.CLOCK, metric: null },
};
