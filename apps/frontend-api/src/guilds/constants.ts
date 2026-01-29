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
