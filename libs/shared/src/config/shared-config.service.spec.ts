import { ConfigService } from '@nestjs/config';
import { SharedConfigService } from './shared-config.service';

function mockConfigService(overrides: Record<string, unknown> = {}): ConfigService {
  const defaults: Record<string, unknown> = {
    POSTGRES_HOST: 'localhost',
    POSTGRES_PORT: 5432,
    POSTGRES_USER: 'postgres',
    POSTGRES_PASSWORD: 'secret',
    POSTGRES_DB: 'sn',
    REDIS_HOST: 'redis',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: undefined,
    CLICKHOUSE_HOST: 'clickhouse',
    CLICKHOUSE_PORT: 8123,
    CLICKHOUSE_USER: 'default',
    CLICKHOUSE_PASSWORD: '',
    CLICKHOUSE_DB: 'default',
    JWT_SECRET: 'jwt-secret',
    ENCRYPTION_KEY_V1: 'a'.repeat(32),
    NODE_ENV: 'development',
    DISCORD_CLIENT_ID: 'client-id',
    DISCORD_CLIENT_SECRET: 'client-secret',
    DISCORD_OAUTH_REDIRECT_URI: 'https://app.example.com/auth/callback',
    ...overrides,
  };
  return {
    get: (key: string) => defaults[key],
  } as unknown as ConfigService;
}

describe('SharedConfigService', () => {
  describe('db', () => {
    it('returns typed database config from env', () => {
      const config = mockConfigService({
        POSTGRES_HOST: 'pg',
        POSTGRES_PORT: 5433,
        POSTGRES_USER: 'u',
        POSTGRES_PASSWORD: 'p',
        POSTGRES_DB: 'mydb',
      });
      const svc = new SharedConfigService(config);
      expect(svc.db).toEqual({
        host: 'pg',
        port: 5433,
        user: 'u',
        password: 'p',
        database: 'mydb',
      });
    });

    it('uses defaults for port when missing', () => {
      const config = mockConfigService({ POSTGRES_PORT: undefined });
      const svc = new SharedConfigService(config);
      expect(svc.db.port).toBe(5432);
    });

    it('uses default empty string for missing host', () => {
      const config = mockConfigService({ POSTGRES_HOST: undefined });
      const svc = new SharedConfigService(config);
      expect(svc.db.host).toBe('');
    });
  });

  describe('redis', () => {
    it('returns prefix sn:test: for NODE_ENV=test', () => {
      const config = mockConfigService({ NODE_ENV: 'test' });
      const svc = new SharedConfigService(config);
      expect(svc.redis.prefix).toBe('sn:test:');
    });

    it('returns prefix sn:dev: for NODE_ENV=development', () => {
      const config = mockConfigService({ NODE_ENV: 'development' });
      const svc = new SharedConfigService(config);
      expect(svc.redis.prefix).toBe('sn:dev:');
    });

    it('returns prefix sn:prod: for NODE_ENV=production', () => {
      const config = mockConfigService({ NODE_ENV: 'production' });
      const svc = new SharedConfigService(config);
      expect(svc.redis.prefix).toBe('sn:prod:');
    });

    it('returns prefix sn:stage: for NODE_ENV=stage', () => {
      const config = mockConfigService({ NODE_ENV: 'stage' });
      const svc = new SharedConfigService(config);
      expect(svc.redis.prefix).toBe('sn:stage:');
    });

    it('returns prefix sn:dev: for unknown NODE_ENV', () => {
      const config = mockConfigService({ NODE_ENV: 'unknown' });
      const svc = new SharedConfigService(config);
      expect(svc.redis.prefix).toBe('sn:dev:');
    });

    it('returns host and port from env', () => {
      const config = mockConfigService({
        REDIS_HOST: 'redis.example.com',
        REDIS_PORT: 6380,
      });
      const svc = new SharedConfigService(config);
      expect(svc.redis.host).toBe('redis.example.com');
      expect(svc.redis.port).toBe(6380);
    });

    it('uses default Redis port 6379 when missing', () => {
      const config = mockConfigService({ REDIS_PORT: undefined });
      const svc = new SharedConfigService(config);
      expect(svc.redis.port).toBe(6379);
    });
  });

  describe('clickhouse', () => {
    it('returns typed clickhouse config from env', () => {
      const config = mockConfigService({
        CLICKHOUSE_HOST: 'ch',
        CLICKHOUSE_PORT: 9000,
        CLICKHOUSE_USER: 'u',
        CLICKHOUSE_PASSWORD: 'p',
        CLICKHOUSE_DB: 'analytics',
      });
      const svc = new SharedConfigService(config);
      expect(svc.clickhouse).toEqual({
        host: 'ch',
        port: 9000,
        user: 'u',
        password: 'p',
        database: 'analytics',
      });
    });

    it('uses default clickhouse port 8123 when missing', () => {
      const config = mockConfigService({ CLICKHOUSE_PORT: undefined });
      const svc = new SharedConfigService(config);
      expect(svc.clickhouse.port).toBe(8123);
    });

    it('uses default empty string for missing clickhouse host', () => {
      const config = mockConfigService({ CLICKHOUSE_HOST: undefined });
      const svc = new SharedConfigService(config);
      expect(svc.clickhouse.host).toBe('');
    });
  });

  describe('discord', () => {
    it('returns client id, secret and oauth redirect uri from env', () => {
      const config = mockConfigService({
        DISCORD_CLIENT_ID: 'cid',
        DISCORD_CLIENT_SECRET: 'csecret',
        DISCORD_OAUTH_REDIRECT_URI: 'https://app.example.com/cb',
      });
      const svc = new SharedConfigService(config);
      expect(svc.discord.clientId).toBe('cid');
      expect(svc.discord.clientSecret).toBe('csecret');
      expect(svc.discord.oauthRedirectUri).toBe('https://app.example.com/cb');
    });

    it('uses default empty string for missing discord client id', () => {
      const config = mockConfigService({ DISCORD_CLIENT_ID: undefined });
      const svc = new SharedConfigService(config);
      expect(svc.discord.clientId).toBe('');
    });
  });

  describe('isDevelopment', () => {
    it('returns true when NODE_ENV is development', () => {
      const config = mockConfigService({ NODE_ENV: 'development' });
      const svc = new SharedConfigService(config);
      expect(svc.isDevelopment).toBe(true);
    });

    it('returns false when NODE_ENV is production', () => {
      const config = mockConfigService({ NODE_ENV: 'production' });
      const svc = new SharedConfigService(config);
      expect(svc.isDevelopment).toBe(false);
    });
  });

  describe('auth', () => {
    it('returns auth config when ENCRYPTION_KEY_V1 is exactly 32 chars', () => {
      const key = 'x'.repeat(32);
      const config = mockConfigService({
        ENCRYPTION_KEY_V1: key,
        JWT_SECRET: 'jwt',
      });
      const svc = new SharedConfigService(config);
      expect(svc.auth.encryptionKeyV1).toBe(key);
      expect(svc.auth.jwtSecret).toBe('jwt');
      expect(svc.auth.adminJwtSecret).toBe('');
    });

    it('returns adminJwtSecret when ADMIN_JWT_SECRET is set', () => {
      const config = mockConfigService({
        ENCRYPTION_KEY_V1: 'a'.repeat(32),
        JWT_SECRET: 'jwt',
        ADMIN_JWT_SECRET: 'admin-secret',
      });
      const svc = new SharedConfigService(config);
      expect(svc.auth.adminJwtSecret).toBe('admin-secret');
    });

    it('uses default empty string for missing JWT_SECRET', () => {
      const config = mockConfigService({
        ENCRYPTION_KEY_V1: 'a'.repeat(32),
        JWT_SECRET: undefined,
      });
      const svc = new SharedConfigService(config);
      expect(svc.auth.jwtSecret).toBe('');
    });

    it('throws when ENCRYPTION_KEY_V1 is missing', () => {
      const config = mockConfigService({ ENCRYPTION_KEY_V1: undefined });
      const svc = new SharedConfigService(config);
      expect(() => svc.auth).toThrow(
        'ENCRYPTION_KEY_V1 must be exactly 32 characters (runtime check failed)',
      );
    });

    it('throws when ENCRYPTION_KEY_V1 length is not 32', () => {
      const config = mockConfigService({ ENCRYPTION_KEY_V1: 'short' });
      const svc = new SharedConfigService(config);
      expect(() => svc.auth).toThrow(
        'ENCRYPTION_KEY_V1 must be exactly 32 characters (runtime check failed)',
      );
    });

    it('throws when ENCRYPTION_KEY_V1 is not a string', () => {
      const config = mockConfigService({ ENCRYPTION_KEY_V1: 123 });
      const svc = new SharedConfigService(config);
      expect(() => svc.auth).toThrow(
        'ENCRYPTION_KEY_V1 must be exactly 32 characters (runtime check failed)',
      );
    });
  });
});
