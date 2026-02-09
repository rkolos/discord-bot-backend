import { publishGuildStateEvent } from './guild-state.publish';
import { GUILD_STATE_CHANNEL_SUFFIX } from './guild-state.constants';

describe('publishGuildStateEvent', () => {
  it('calls redis.publish with correct channel when prefix is empty', () => {
    const publish = jest.fn().mockResolvedValue(1);
    const redis = { publish } as unknown as import('ioredis').Redis;
    publishGuildStateEvent(redis, '', {
      guildId: 'g-uuid',
      discordGuildId: '123',
      parameter: 'historySyncStatus',
      direction: 'set',
      value: 'COMPLETED',
    });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      GUILD_STATE_CHANNEL_SUFFIX,
      expect.stringContaining('"parameter":"historySyncStatus"'),
    );
    const payload = JSON.parse(publish.mock.calls[0][1]);
    expect(payload.guildId).toBe('g-uuid');
    expect(payload.discordGuildId).toBe('123');
    expect(payload.value).toBe('COMPLETED');
    expect(payload.timestamp).toBeDefined();
  });

  it('uses prefix + suffix as channel when prefix is provided', () => {
    const publish = jest.fn().mockResolvedValue(1);
    const redis = { publish } as unknown as import('ioredis').Redis;
    publishGuildStateEvent(redis, 'sn:dev:', {
      guildId: 'g-uuid',
      discordGuildId: '456',
      parameter: 'memberCount',
      direction: 'set',
      value: 100,
    });
    expect(publish).toHaveBeenCalledWith(
      'sn:dev:' + GUILD_STATE_CHANNEL_SUFFIX,
      expect.any(String),
    );
    const payload = JSON.parse(publish.mock.calls[0][1]);
    expect(payload.value).toBe(100);
  });

  it('preserves timestamp when provided', () => {
    const publish = jest.fn().mockResolvedValue(1);
    const redis = { publish } as unknown as import('ioredis').Redis;
    const ts = '2025-02-03T12:00:00.000Z';
    publishGuildStateEvent(redis, '', {
      guildId: 'g',
      discordGuildId: 'd',
      parameter: 'lastActivity',
      direction: 'set',
      value: ts,
      timestamp: ts,
    });
    const payload = JSON.parse(publish.mock.calls[0][1]);
    expect(payload.timestamp).toBe(ts);
  });

  it('publishes bot_status with value installed or not_installed', () => {
    const publish = jest.fn().mockResolvedValue(1);
    const redis = { publish } as unknown as import('ioredis').Redis;
    publishGuildStateEvent(redis, '', {
      guildId: 'g-uuid',
      discordGuildId: '123',
      parameter: 'bot_status',
      direction: 'set',
      value: 'installed',
    });
    const payload = JSON.parse(publish.mock.calls[0][1]);
    expect(payload.parameter).toBe('bot_status');
    expect(payload.value).toBe('installed');
    expect(payload.direction).toBe('set');
  });

  it('publishes totalMessages with direction set and value as number', () => {
    const publish = jest.fn().mockResolvedValue(1);
    const redis = { publish } as unknown as import('ioredis').Redis;
    publishGuildStateEvent(redis, 'sn:dev:', {
      guildId: 'g-uuid',
      discordGuildId: '456',
      parameter: 'totalMessages',
      direction: 'set',
      value: 12500,
    });
    const payload = JSON.parse(publish.mock.calls[0][1]);
    expect(payload.parameter).toBe('totalMessages');
    expect(payload.direction).toBe('set');
    expect(payload.value).toBe(12500);
  });
});
