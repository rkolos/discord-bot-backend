/**
 * Минимальные переменные окружения для интеграционных тестов с SharedConfigModule.
 * Вызывать перед созданием Nest-модулей, переопределяя значения контейнеров по необходимости.
 */
export function setTestIntegrationEnv(overrides: Record<string, string | number | undefined> = {}): void {
  const defaults: Record<string, string | number> = {
    NODE_ENV: 'test',
    POSTGRES_HOST: 'localhost',
    POSTGRES_PORT: 5432,
    POSTGRES_USER: 'postgres',
    POSTGRES_PASSWORD: 'postgres',
    POSTGRES_DB: 'test',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    CLICKHOUSE_HOST: 'localhost',
    CLICKHOUSE_PORT: 8123,
    CLICKHOUSE_USER: 'default',
    CLICKHOUSE_PASSWORD: 'default',
    CLICKHOUSE_DB: 'default',
    JWT_SECRET: 'test-jwt-secret-32-chars!!!',
    ADMIN_JWT_SECRET: 'test-admin-jwt-secret',
    ENCRYPTION_KEY_V1: 'a'.repeat(32),
    FRONTEND_API_URL: 'http://localhost:3000',
    ADMIN_API_URL: 'http://localhost:3001',
    DISCORD_CLIENT_ID: 'test-client-id',
    DISCORD_CLIENT_SECRET: 'test-client-secret',
    DISCORD_OAUTH_REDIRECT_URI: 'http://localhost:3000/api/auth/discord/callback',
    ...overrides,
  };
  for (const [k, v] of Object.entries(defaults)) {
    if (v !== undefined) (process.env as Record<string, string>)[k] = String(v);
  }
}
