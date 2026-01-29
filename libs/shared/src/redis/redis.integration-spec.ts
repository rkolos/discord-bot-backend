import { RedisContainer } from '@testcontainers/redis';
import Redis from 'ioredis';
import { setTestIntegrationEnv } from '../test-integration-env';

describe('Redis integration (prefix)', () => {
  let container: { stop: () => Promise<unknown> };
  let redisService: { set: (k: string, v: string) => Promise<'OK' | void> };
  let rawRedis: Redis;
  let nestRedisClient: { disconnect: () => void } | undefined;

  beforeAll(async () => {
    const started = await new RedisContainer('redis:7-alpine').start();
    container = started;

    setTestIntegrationEnv({
      NODE_ENV: 'test',
      REDIS_HOST: started.getHost(),
      REDIS_PORT: started.getPort(),
    });

    const { Test } = await import('@nestjs/testing');
    const { SharedConfigModule } = await import('../config/shared-config.module');
    const { RedisModule } = await import('./redis.module');
    const { RedisService } = await import('./redis.service');
    const { REDIS_CLIENT } = await import('./redis.constants');

    const mod = await Test.createTestingModule({
      imports: [SharedConfigModule, RedisModule.forRootAsync()],
    }).compile();

    redisService = mod.get(RedisService);
    nestRedisClient = mod.get(REDIS_CLIENT);

    rawRedis = new Redis({
      host: started.getHost(),
      port: started.getPort(),
    });
  }, 60_000);

  afterAll(async () => {
    rawRedis?.disconnect();
    nestRedisClient?.disconnect();
    if (container) await container.stop();
  });

  it('writes keys with sn:test: prefix and they are visible via raw client', async () => {
    await redisService.set('integration-key', 'value');

    const keys = await rawRedis.keys('sn:test:*');
    expect(keys.length).toBeGreaterThanOrEqual(1);
    expect(keys.some((k) => k.startsWith('sn:test:') && k.includes('integration-key'))).toBe(true);
  });
});
