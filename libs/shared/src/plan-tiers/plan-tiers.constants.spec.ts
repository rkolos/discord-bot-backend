import {
  PLAN_TIER_LIMITS,
  MAX_DATA_RETENTION_DAYS,
  normalizePlanTier,
  getRetentionDaysForTier,
  getAnalyticsMaxDaysForTier,
  getPlanTierLimits,
} from './plan-tiers.constants';

describe('plan-tiers constants', () => {
  describe('PLAN_TIER_LIMITS', () => {
    it('free tier has analyticsMaxDays 365, retentionDays 30', () => {
      expect(PLAN_TIER_LIMITS.free.analyticsMaxDays).toBe(365);
      expect(PLAN_TIER_LIMITS.free.retentionDays).toBe(30);
      expect(PLAN_TIER_LIMITS.free.maxCountersPerGuild).toBe(5);
    });

    it('premium tier has analyticsMaxDays null, retentionDays 365', () => {
      expect(PLAN_TIER_LIMITS.premium.analyticsMaxDays).toBeNull();
      expect(PLAN_TIER_LIMITS.premium.retentionDays).toBe(365);
      expect(PLAN_TIER_LIMITS.premium.maxCountersPerGuild).toBe(50);
    });
  });

  describe('MAX_DATA_RETENTION_DAYS', () => {
    it('equals 365', () => {
      expect(MAX_DATA_RETENTION_DAYS).toBe(365);
    });
  });

  describe('normalizePlanTier', () => {
    it('returns premium only for "premium" (case-insensitive)', () => {
      expect(normalizePlanTier('premium')).toBe('premium');
      expect(normalizePlanTier('Premium')).toBe('premium');
      expect(normalizePlanTier('PREMIUM')).toBe('premium');
    });

    it('returns free for free, pro, enterprise, unknown', () => {
      expect(normalizePlanTier('free')).toBe('free');
      expect(normalizePlanTier('pro')).toBe('free');
      expect(normalizePlanTier('enterprise')).toBe('free');
      expect(normalizePlanTier('unknown')).toBe('free');
    });

    it('returns free for null and undefined', () => {
      expect(normalizePlanTier(null)).toBe('free');
      expect(normalizePlanTier(undefined)).toBe('free');
    });
  });

  describe('getRetentionDaysForTier', () => {
    it('returns 30 for free and non-premium', () => {
      expect(getRetentionDaysForTier('free')).toBe(30);
      expect(getRetentionDaysForTier('pro')).toBe(30);
      expect(getRetentionDaysForTier('enterprise')).toBe(30);
      expect(getRetentionDaysForTier('unknown')).toBe(30);
    });

    it('returns 365 for premium', () => {
      expect(getRetentionDaysForTier('premium')).toBe(365);
    });
  });

  describe('getAnalyticsMaxDaysForTier', () => {
    it('returns 365 for free and non-premium', () => {
      expect(getAnalyticsMaxDaysForTier('free')).toBe(365);
      expect(getAnalyticsMaxDaysForTier('pro')).toBe(365);
      expect(getAnalyticsMaxDaysForTier('enterprise')).toBe(365);
    });

    it('returns null for premium', () => {
      expect(getAnalyticsMaxDaysForTier('premium')).toBeNull();
    });
  });

  describe('getPlanTierLimits', () => {
    it('returns free limits for free and non-premium', () => {
      const freeLimits = getPlanTierLimits('free');
      expect(freeLimits).toEqual(PLAN_TIER_LIMITS.free);
      expect(getPlanTierLimits('pro')).toEqual(PLAN_TIER_LIMITS.free);
    });

    it('returns premium limits for premium', () => {
      expect(getPlanTierLimits('premium')).toEqual(PLAN_TIER_LIMITS.premium);
    });
  });
});
