/**
 * Централизованные константы имен очередей для всего проекта.
 * Полный ключ в Redis формируется как: sn:{env}:{QUEUE_NAME}
 * где {env} - dev, stage или prod.
 */

/** Обновление счетчиков Discord (названия каналов) */
export const COUNTERS_UPDATE_QUEUE_NAME = 'workers-queue-counters-update';

/** Настройка гильдий при добавлении бота */
export const GUILD_SETUP_QUEUE_NAME = 'workers-queue-guild-setup';

/** Синхронизация исторических данных гильдии */
export const HISTORY_SYNC_QUEUE_NAME = 'workers-queue-history-sync';

/** Raw events от Discord Gateway в ClickHouse */
export const INGESTOR_RAW_EVENTS_QUEUE_NAME = 'ingestor-raw-events';

/** Обновление кеша настроек логирования гильдий */
export const LOGS_CONFIG_QUEUE_NAME = 'workers-queue-logs-config';

/** Обновление кеша настроек приветствия/прощания */
export const WELCOME_GOODBYE_CONFIG_QUEUE_NAME = 'workers-queue-welcome-goodbye-config';

/** GDPR удаление данных пользователей */
export const GDPR_USER_DELETE_QUEUE_NAME = 'workers-queue-gdpr-user-delete';

/**
 * Массив всех известных очередей для мониторинга в Admin API.
 * Используется для получения метрик всех очередей.
 */
export const ALL_QUEUE_NAMES = [
  COUNTERS_UPDATE_QUEUE_NAME,
  GUILD_SETUP_QUEUE_NAME,
  HISTORY_SYNC_QUEUE_NAME,
  INGESTOR_RAW_EVENTS_QUEUE_NAME,
  LOGS_CONFIG_QUEUE_NAME,
  WELCOME_GOODBYE_CONFIG_QUEUE_NAME,
  GDPR_USER_DELETE_QUEUE_NAME,
] as const;
