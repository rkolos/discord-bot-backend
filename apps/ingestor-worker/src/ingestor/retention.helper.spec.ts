import { computeRetentionUntil } from './retention.helper';

describe('computeRetentionUntil', () => {
  const base = new Date('2025-01-15T12:00:00.000Z');

  it('free: event_time + 30 days', () => {
    const r = computeRetentionUntil(base, 'free');
    expect(r.toISOString()).toBe('2025-02-14T12:00:00.000Z');
  });

  it('free (default when unknown tier): event_time + 30 days', () => {
    const r = computeRetentionUntil(base, 'unknown');
    expect(r.toISOString()).toBe('2025-02-14T12:00:00.000Z');
  });

  it('premium: event_time + 365 days', () => {
    const r = computeRetentionUntil(base, 'premium');
    expect(r.toISOString()).toBe('2026-01-15T12:00:00.000Z');
  });

  it('pro: fallback to free → event_time + 30 days', () => {
    const r = computeRetentionUntil(base, 'pro');
    expect(r.toISOString()).toBe('2025-02-14T12:00:00.000Z');
  });

  it('enterprise: fallback to free → event_time + 30 days', () => {
    const r = computeRetentionUntil(base, 'enterprise');
    expect(r.toISOString()).toBe('2025-02-14T12:00:00.000Z');
  });

  it('accepts ISO string eventTime', () => {
    const r = computeRetentionUntil('2025-01-15T12:00:00.000Z', 'free');
    expect(r.toISOString()).toBe('2025-02-14T12:00:00.000Z');
  });

  it('planTier case-insensitive', () => {
    expect(computeRetentionUntil(base, 'FREE').toISOString()).toBe(
      '2025-02-14T12:00:00.000Z',
    );
    expect(computeRetentionUntil(base, 'Premium').toISOString()).toBe(
      '2026-01-15T12:00:00.000Z',
    );
  });
});
