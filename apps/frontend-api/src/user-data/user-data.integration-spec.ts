import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { join } from 'path';
import {
  User,
  Guild,
  GuildStatus,
  GuildSubscriptionTier,
  UserPlan,
  UserStatus,
  ServerSettings,
  AllExceptionsFilter,
} from '@app/shared';
import { setTestIntegrationEnv } from '@app/shared/test-integration-env';
import { UserDataService } from './user-data.service';
import { AppModule } from '../app.module';
import { HttpAdapterHost } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';

describe('UserDataService integration (GDPR Cleanup)', () => {
  let pgContainer: Awaited<ReturnType<PostgreSqlContainer['start']>>;
  let redisContainer: Awaited<ReturnType<RedisContainer['start']>>;
  let ds: DataSource;
  let userDataService: UserDataService;
  let app: { close: () => Promise<void> };

  beforeAll(async () => {
    pgContainer = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('test')
      .withUsername('postgres')
      .withPassword('postgres')
      .start();
    redisContainer = await new RedisContainer('redis:7-alpine').start();

    setTestIntegrationEnv({
      NODE_ENV: 'test',
      POSTGRES_HOST: pgContainer.getHost(),
      POSTGRES_PORT: pgContainer.getPort(),
      POSTGRES_USER: pgContainer.getUsername(),
      POSTGRES_PASSWORD: pgContainer.getPassword(),
      POSTGRES_DB: pgContainer.getDatabase(),
      REDIS_HOST: redisContainer.getHost(),
      REDIS_PORT: redisContainer.getPort(),
      ENCRYPTION_KEY_V1: 'a'.repeat(32),
      JWT_SECRET: 'jwt-secret',
    });

    const { DataSource: TypeOrmDataSource } = await import('typeorm');
    const entities = await import('@app/shared').then((m) =>
      [
        m.ActivityLog,
        m.AdminUser,
        m.Company,
        m.CompanyInvite,
        m.CompanyMember,
        m.Counter,
        m.Guild,
        m.GuildLogSetting,
        m.GuildModule,
        m.Invoice,
        m.PlanLimits,
        m.RefreshToken,
        m.ServerSettings,
        m.SubscriptionPlan,
        m.UsageLimits,
        m.User,
        m.UserSubscription,
        m.Widget,
      ].filter(Boolean),
    );

    const tempDs = new DataSource({
      type: 'postgres',
      host: pgContainer.getHost(),
      port: pgContainer.getPort(),
      username: pgContainer.getUsername(),
      password: pgContainer.getPassword(),
      database: pgContainer.getDatabase(),
      entities,
      migrations: [join(process.cwd(), 'libs/shared/src/database/migrations', '*.{ts,js}')],
      synchronize: false,
    });
    await tempDs.initialize();
    await tempDs.runMigrations();
    await tempDs.destroy();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const nestApp = moduleRef.createNestApplication();
    nestApp.setGlobalPrefix('api');
    const httpAdapterHost = nestApp.get(HttpAdapterHost);
    nestApp.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));
    nestApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors: unknown) => new BadRequestException(errors),
      }),
    );
    await nestApp.init();
    app = nestApp;

    ds = nestApp.get(TypeOrmDataSource);
    userDataService = nestApp.get(UserDataService);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    if (ds?.isInitialized) await ds.destroy();
    await redisContainer?.stop();
    await pgContainer?.stop();
  }, 30_000);

  it('deleteAllUserData removes user and owned guilds from PostgreSQL', async () => {
    const userRepo = ds.getRepository(User);
    const guildRepo = ds.getRepository(Guild);
    const settingsRepo = ds.getRepository(ServerSettings);

    const user = await userRepo.save(
      userRepo.create({
        discordId: '999888777666555444',
        username: 'gdpr-test-user',
        plan: UserPlan.FREE,
        status: UserStatus.ACTIVE,
      }),
    );
    const discordGuildId = String(111222333444555666n + BigInt(Date.now() % 1000000));
    const guild = await guildRepo.save(
      guildRepo.create({
        discordGuildId,
        name: 'GDPR Test Guild',
        ownerId: user.id,
        status: GuildStatus.ACTIVE,
        subscriptionTier: GuildSubscriptionTier.FREE,
        memberCount: 0,
        messageCount: '0',
        isBotInGuild: false,
      }),
    );
    await settingsRepo.save(
      settingsRepo.create({
        guildId: guild.id,
        serverName: 'Test',
        language: 'en',
        timezone: 'UTC',
        updatedAt: new Date(),
      }),
    );

    await userDataService.deleteAllUserData(user);

    const userAfter = await userRepo.findOne({ where: { id: user.id } });
    const guildAfter = await guildRepo.findOne({ where: { id: guild.id } });
    expect(userAfter).toBeNull();
    expect(guildAfter).toBeNull();
  });
});
