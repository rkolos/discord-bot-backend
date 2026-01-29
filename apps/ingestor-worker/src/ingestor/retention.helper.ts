/** Task 4.1: free → 30 дней, premium/pro/enterprise → 365 дней. */
const RETENTION_DAYS_FREE = 30;
const RETENTION_DAYS_PREMIUM = 365;

const PREMIUM_TIERS = ['premium', 'pro', 'enterprise'];

/**
 * Вычисляет retention_until по тарифу.
 * free → event_time + 30 дней; premium/pro/enterprise → event_time + 365 дней.
 */
export function computeRetentionUntil(
  eventTime: Date | string,
  planTier: string,
): Date {
  const t = typeof eventTime === 'string' ? new Date(eventTime) : eventTime;
  const tier = (planTier ?? 'free').toLowerCase();
  const days = PREMIUM_TIERS.includes(tier)
    ? RETENTION_DAYS_PREMIUM
    : RETENTION_DAYS_FREE;
  const out = new Date(t);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}
