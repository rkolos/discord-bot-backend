import { getRetentionDaysForTier } from '@app/shared';

/**
 * Вычисляет retention_until по тарифу.
 * free (и любой не-premium) → event_time + 30 дней; premium → event_time + 365 дней.
 */
export function computeRetentionUntil(
  eventTime: Date | string,
  planTier: string,
): Date {
  const t = typeof eventTime === 'string' ? new Date(eventTime) : eventTime;
  const days = getRetentionDaysForTier(planTier);
  const out = new Date(t);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}
