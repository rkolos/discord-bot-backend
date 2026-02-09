import type { Redis } from 'ioredis';
import type { DiscordEventPayload } from './discord-event.types';
import { DISCORD_EVENTS_CHANNEL_SUFFIX } from './guild-state.constants';

/**
 * Публикует событие Discord в Redis для доставки на фронт по WebSocket.
 * @param redis — клиент Redis.
 * @param prefix — префикс канала (напр. 'sn:dev:' в shard-worker).
 */
export function publishDiscordEvent(
  redis: Redis,
  prefix: string,
  payload: DiscordEventPayload,
): void {
  const full: DiscordEventPayload = {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  };
  const channel = prefix ? prefix + DISCORD_EVENTS_CHANNEL_SUFFIX : DISCORD_EVENTS_CHANNEL_SUFFIX;
  redis.publish(channel, JSON.stringify(full)).catch(() => {});
}
