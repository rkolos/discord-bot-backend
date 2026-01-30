import { computeAnonymizedHash } from './anonymization.util';

describe('computeAnonymizedHash', () => {
  const salt = 'server-static-salt-32chars!!';
  const discordUserId1 = '123456789012345678';
  const discordUserId2 = '987654321098765432';

  it('returns the same hash for the same discordUserId and salt (determinism)', () => {
    const hash1 = computeAnonymizedHash(discordUserId1, salt);
    const hash2 = computeAnonymizedHash(discordUserId1, salt);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns different hashes for different users (no collision)', () => {
    const hash1 = computeAnonymizedHash(discordUserId1, salt);
    const hash2 = computeAnonymizedHash(discordUserId2, salt);
    expect(hash1).not.toBe(hash2);
  });

  it('returns different hashes for the same user with different salts', () => {
    const hash1 = computeAnonymizedHash(discordUserId1, salt);
    const hash2 = computeAnonymizedHash(discordUserId1, 'other-salt');
    expect(hash1).not.toBe(hash2);
  });

  it('returns 64-character hex string (SHA-256)', () => {
    const hash = computeAnonymizedHash(discordUserId1, salt);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hash collision check: many distinct users produce distinct hashes', () => {
    const hashes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const id = String(1000000000000000000n + BigInt(i));
      hashes.add(computeAnonymizedHash(id, salt));
    }
    expect(hashes.size).toBe(100);
  });
});
