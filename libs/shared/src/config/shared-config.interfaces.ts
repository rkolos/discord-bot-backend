/**
 * Интерфейсы конфигурации для типизированного доступа к переменным окружения.
 * Соответствуют схеме валидации env-validation.schema.ts.
 */

export interface IDatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface IRedisConfig {
  host: string;
  port: number;
  password?: string;
  prefix: string;
}

export interface IClickHouseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface IAuthConfig {
  jwtSecret: string;
  adminJwtSecret?: string;
  encryptionKeyV1: string;
}

export interface IDiscordConfig {
  clientId: string;
  clientSecret: string;
  oauthRedirectUri: string;
}
