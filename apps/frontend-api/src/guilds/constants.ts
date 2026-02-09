/**
 * Допустимые ключи модулей гильдии (guild_modules.module_key).
 * При создании/обновлении GuildModule использовать только ключи из этого списка.
 */
export const ALLOWED_MODULE_KEYS = ['counters', 'analytics'] as const;

export type AllowedModuleKey = (typeof ALLOWED_MODULE_KEYS)[number];

/** Отображаемое имя модуля по ключу (для ответа API). */
export const MODULE_DISPLAY_NAMES: Record<AllowedModuleKey, string> = {
  counters: 'Counters',
  analytics: 'Analytics',
};

/** Канал Redis для уведомления bot-service об изменении настроек гильдии (перезагрузка шардов). */
export const GUILD_SETTINGS_CHANGED_CHANNEL_SUFFIX =
  'frontend-api:channel:guild:settings-changed';

/** Уровень активности гильдии для бейджа (activity-sparkline). */
export type ActivityLevel = 'live' | 'active' | 'quiet';

/** Порог «активного» часа: последний час ≥ этого значения → active. */
export const ACTIVITY_ACTIVE_LAST_HOUR_THRESHOLD = 5;

/** Порог «тишины» за сутки: сумма 24 часов < 1 → quiet. */
export const ACTIVITY_QUIET_24H_THRESHOLD = 1;

/**
 * Вычисляет уровень активности по подключению бота и данным за 24 часа.
 * live — бот подключён; active — за сутки ≥ 1 сообщение; quiet — за сутки < 1 или нет данных.
 */
export function computeActivityLevel(
  botConnected: boolean,
  data: number[],
): ActivityLevel {
  if (botConnected) return 'live';
  if (!data.length) return 'quiet';
  const sum24h = data.reduce((a, b) => a + b, 0);
  if (sum24h < ACTIVITY_QUIET_24H_THRESHOLD) return 'quiet';
  return 'active';
}
