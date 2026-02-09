import type { Redis } from 'ioredis';
import type { GuildStateEventPayload } from './guild-state.types';
import { GUILD_STATE_CHANNEL_SUFFIX } from './guild-state.constants';

/**
 * Публикует событие состояния гильдии в Redis.
 * Используется ingestor-worker, bot-service и при необходимости frontend-api.
 * @param redis — клиент Redis (в NestJS с keyPrefix; в shard-worker без keyPrefix).
 * @param prefix — префикс канала ('' в NestJS — тогда используется keyPrefix клиента; в shard-worker — полный префикс, напр. 'sn:dev:').
 */
export function publishGuildStateEvent(
  redis: Redis,
  prefix: string,
  payload: GuildStateEventPayload,
): void {
  const full: GuildStateEventPayload = {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  };
  const channel = prefix ? prefix + GUILD_STATE_CHANNEL_SUFFIX : GUILD_STATE_CHANNEL_SUFFIX;
  redis.publish(channel, JSON.stringify(full)).catch(() => {});
}
