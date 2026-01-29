/**
 * Токен инжекции клиента IORedis в DI.
 * Используется RedisService и при необходимости BullMQ (Эпики 3–4).
 */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
