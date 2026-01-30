import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  IAuthConfig,
  IClickHouseConfig,
  IDatabaseConfig,
  IDiscordConfig,
  IIngestorConfig,
  IRedisConfig,
} from './shared-config.interfaces';

const NODE_ENV_TO_PREFIX: Record<string, string> = {
  development: 'dev',
  production: 'prod',
  stage: 'stage',
  test: 'test',
};

@Injectable()
export class SharedConfigService {
  constructor(private readonly configService: ConfigService) {}

  get db(): IDatabaseConfig {
    return {
      host: this.configService.get<string>('POSTGRES_HOST') ?? '',
      port: this.configService.get<number>('POSTGRES_PORT') ?? 5432,
      user: this.configService.get<string>('POSTGRES_USER') ?? '',
      password: this.configService.get<string>('POSTGRES_PASSWORD') ?? '',
      database: this.configService.get<string>('POSTGRES_DB') ?? '',
    };
  }

  get redis(): IRedisConfig {
    const nodeEnv = this.configService.get<string>('NODE_ENV') ?? 'development';
    const envShort = NODE_ENV_TO_PREFIX[nodeEnv] ?? 'dev';
    return {
      host: this.configService.get<string>('REDIS_HOST') ?? '',
      port: this.configService.get<number>('REDIS_PORT') ?? 6379,
      password: this.configService.get<string>('REDIS_PASSWORD'),
      prefix: `sn:${envShort}:`,
    };
  }

  get clickhouse(): IClickHouseConfig {
    return {
      host: this.configService.get<string>('CLICKHOUSE_HOST') ?? '',
      port: this.configService.get<number>('CLICKHOUSE_PORT') ?? 8123,
      user: this.configService.get<string>('CLICKHOUSE_USER') ?? '',
      password: this.configService.get<string>('CLICKHOUSE_PASSWORD') ?? '',
      database: this.configService.get<string>('CLICKHOUSE_DB') ?? '',
    };
  }

  get auth(): IAuthConfig {
    const encryptionKeyV1 = this.configService.get<string>('ENCRYPTION_KEY_V1');
    if (typeof encryptionKeyV1 !== 'string' || encryptionKeyV1.length !== 32) {
      throw new Error(
        'ENCRYPTION_KEY_V1 must be exactly 32 characters (runtime check failed)',
      );
    }
    const jwtSecret = this.configService.get<string>('JWT_SECRET') ?? '';
    const anonymizationSalt =
      this.configService.get<string>('ANONYMIZATION_SALT') ??
      (jwtSecret ? jwtSecret.slice(0, 32) : '');
    return {
      jwtSecret,
      adminJwtSecret:
        this.configService.get<string>('ADMIN_JWT_SECRET') ?? '',
      encryptionKeyV1,
      anonymizationSalt,
    };
  }

  get discord(): IDiscordConfig {
    return {
      clientId: this.configService.get<string>('DISCORD_CLIENT_ID') ?? '',
      clientSecret: this.configService.get<string>('DISCORD_CLIENT_SECRET') ?? '',
      oauthRedirectUri:
        this.configService.get<string>('DISCORD_OAUTH_REDIRECT_URI') ?? '',
      frontendBaseUrl:
        this.configService.get<string>('FRONTEND_BASE_URL') ?? undefined,
    };
  }

  get isDevelopment(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'development';
  }

  get ingestor(): IIngestorConfig {
    return {
      batchSize: this.configService.get<number>('INGESTOR_BATCH_SIZE') ?? 1000,
      batchIntervalMs:
        this.configService.get<number>('INGESTOR_BATCH_INTERVAL_MS') ?? 5000,
    };
  }
}
