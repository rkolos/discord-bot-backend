/** Тарифный план: пока только free и premium. */
export type PlanTierId = 'free' | 'premium';

/** Лимиты по тарифу (retention, аналитика, счётчики). */
export interface PlanTierLimits {
  /** Макс. период запроса аналитики в днях; null = без ограничения. */
  analyticsMaxDays: number | null;
  /** Срок хранения событий в ClickHouse (дней). */
  retentionDays: number;
  /** Макс. количество счётчиков на гильдию. */
  maxCountersPerGuild: number;
}
