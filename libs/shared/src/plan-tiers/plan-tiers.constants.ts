import type { PlanTierId, PlanTierLimits } from './plan-tiers.types';

/** Лимиты по тарифу. Тарифов пока два: free и premium. */
export const PLAN_TIER_LIMITS: Record<PlanTierId, PlanTierLimits> = {
  free: {
    analyticsMaxDays: 365,
    retentionDays: 30,
    maxCountersPerGuild: 5,
  },
  premium: {
    analyticsMaxDays: null,
    retentionDays: 365,
    maxCountersPerGuild: 50,
  },
};

/** Макс. допустимое значение data_retention_days в настройках гильдии (по всем тарифам). */
export const MAX_DATA_RETENTION_DAYS = 365;

/**
 * Нормализует входящий тариф из API/БД к PlanTierId.
 * Только строго 'premium' даёт premium; всё остальное (в т.ч. pro, enterprise) — free.
 */
export function normalizePlanTier(planTier: string | null | undefined): PlanTierId {
  const tier = (planTier ?? 'free').toLowerCase();
  return tier === 'premium' ? 'premium' : 'free';
}

/**
 * Возвращает срок хранения событий в ClickHouse (дней) для данного тарифа.
 */
export function getRetentionDaysForTier(planTier: string | null | undefined): number {
  const tier = normalizePlanTier(planTier);
  return PLAN_TIER_LIMITS[tier].retentionDays;
}

/**
 * Возвращает макс. период запроса аналитики в днях для данного тарифа.
 * null означает без ограничения.
 */
export function getAnalyticsMaxDaysForTier(
  planTier: string | null | undefined,
): number | null {
  const tier = normalizePlanTier(planTier);
  return PLAN_TIER_LIMITS[tier].analyticsMaxDays;
}

/**
 * Возвращает лимиты по тарифу.
 */
export function getPlanTierLimits(planTier: string | null | undefined): PlanTierLimits {
  const tier = normalizePlanTier(planTier);
  return PLAN_TIER_LIMITS[tier];
}
