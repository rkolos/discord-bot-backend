import { Injectable } from '@nestjs/common';
import { GuildStateRedisSubscriberService } from './guild-state-redis-subscriber.service';

/**
 * Провайдер только для инициализации realtime при старте.
 * Инжектит GuildStateRedisSubscriberService, чтобы Nest гарантированно создал подписчика на Redis.
 * Подписка на Redis запускается в onApplicationBootstrap подписчика (после инициализации WebSocket gateway).
 */
@Injectable()
export class RealtimeBootstrapService {
  constructor(private readonly _redisSubscriber: GuildStateRedisSubscriberService) {
    this._redisSubscriber.start();
  }
}
