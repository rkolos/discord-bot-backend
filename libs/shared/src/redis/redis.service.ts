import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly client: Redis,
  ) {}

  get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<'OK' | void> {
    if (ttlSeconds != null && ttlSeconds > 0) {
      return this.client.setex(key, ttlSeconds, value) as Promise<'OK'>;
    }
    return this.client.set(key, value) as Promise<'OK'>;
  }

  del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  /**
   * Возвращает сырой клиент IORedis для Streams, pipeline и прочих сценариев.
   * BullMQ при интеграции может использовать те же опции из SharedConfigService.redis.
   */
  getClient(): Redis {
    return this.client;
  }
}
