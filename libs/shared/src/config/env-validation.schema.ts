import * as Joi from 'joi';

/**
 * Схема валидации переменных окружения при старте приложения.
 * Используется в ConfigModule.forRoot({ validationSchema: envValidationSchema }).
 * При отсутствии или неверном формате критических переменных процесс не стартует (exit 1).
 */
export const envValidationSchema = Joi.object({
  // PostgreSQL
  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().default(5432),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().required(),

  // Redis
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional(),

  // ClickHouse
  CLICKHOUSE_HOST: Joi.string().required(),
  CLICKHOUSE_PORT: Joi.number().default(8123),
  CLICKHOUSE_USER: Joi.string().required(),
  CLICKHOUSE_PASSWORD: Joi.string().allow('').required(),
  CLICKHOUSE_DB: Joi.string().required(),

  // Безопасность и JWT
  JWT_SECRET: Joi.string().required(),
  ADMIN_JWT_SECRET: Joi.string().optional(),
  ENCRYPTION_KEY_V1: Joi.string().length(32).required(),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'stage')
    .default('development'),

  // API и Discord
  FRONTEND_API_URL: Joi.string().uri().required(),
  ADMIN_API_URL: Joi.string().uri().required(),
  DISCORD_CLIENT_ID: Joi.string().required(),
  DISCORD_CLIENT_SECRET: Joi.string().required(),
  DISCORD_OAUTH_REDIRECT_URI: Joi.string().uri().required(),
});
