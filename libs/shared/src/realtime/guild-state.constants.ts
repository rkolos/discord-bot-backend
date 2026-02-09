/**
 * Канал Redis для событий состояния гильдий (real-time push на фронт).
 * Полный ключ: sn:{env}:frontend-api:channel:guild-state
 */
export const GUILD_STATE_CHANNEL_SUFFIX = 'frontend-api:channel:guild-state';

/**
 * Канал Redis для «сырых» событий Discord (полный payload на фронт).
 * Полный ключ: sn:{env}:frontend-api:channel:discord-events
 */
export const DISCORD_EVENTS_CHANNEL_SUFFIX = 'frontend-api:channel:discord-events';
