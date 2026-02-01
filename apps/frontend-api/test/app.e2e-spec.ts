import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { ClickHouseContainer } from '@testcontainers/clickhouse';
import { Test } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { GuildsService } from '../src/guilds/guilds.service';
import { Guild } from '@app/shared';
import { User } from '@app/shared';
const request = require('supertest');

function parseChUrl(url: string): { host: string; port: number } {
  const u = new URL(url);
  return { host: u.hostname, port: parseInt(u.port || '8123', 10) };
}

describe('Frontend API E2E (validation contract)', () => {
  let pgContainer: Awaited<ReturnType<PostgreSqlContainer['start']>>;
  let redisContainer: Awaited<ReturnType<RedisContainer['start']>>;
  let app: { getHttpServer: () => unknown; close: () => Promise<void> };
  let ds: DataSource;

  beforeAll(async () => {
    pgContainer = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('test')
      .withUsername('postgres')
      .withPassword('postgres')
      .start();
    redisContainer = await new RedisContainer('redis:7-alpine').start();

    const { setTestIntegrationEnv } = await import('@app/shared/test-integration-env');
    setTestIntegrationEnv({
      NODE_ENV: 'test',
      POSTGRES_HOST: pgContainer.getHost(),
      POSTGRES_PORT: pgContainer.getPort(),
      POSTGRES_USER: pgContainer.getUsername(),
      POSTGRES_PASSWORD: pgContainer.getPassword(),
      POSTGRES_DB: pgContainer.getDatabase(),
      REDIS_HOST: redisContainer.getHost(),
      REDIS_PORT: redisContainer.getPort(),
    });

    const {
      ActivityLog,
      AdminUser,
      Company,
      CompanyInvite,
      CompanyMember,
      Counter,
      Guild,
      GuildLogSetting,
      GuildModule,
      Invoice,
      PlanLimits,
      RefreshToken,
      ServerSettings,
      SubscriptionPlan,
      UsageLimits,
      User,
      UserSubscription,
      Widget,
      AllExceptionsFilter,
    } = await import('@app/shared');

    const ENTITIES = [
      ActivityLog,
      AdminUser,
      Company,
      CompanyInvite,
      CompanyMember,
      Counter,
      Guild,
      GuildLogSetting,
      GuildModule,
      Invoice,
      PlanLimits,
      RefreshToken,
      ServerSettings,
      SubscriptionPlan,
      UsageLimits,
      User,
      UserSubscription,
      Widget,
    ];

    ds = new DataSource({
      type: 'postgres',
      host: pgContainer.getHost(),
      port: pgContainer.getPort(),
      username: pgContainer.getUsername(),
      password: pgContainer.getPassword(),
      database: pgContainer.getDatabase(),
      entities: ENTITIES,
      migrations: [join(process.cwd(), 'libs/shared/src/database/migrations', '*.{ts,js}')],
      synchronize: false,
    });
    await ds.initialize();
    await ds.runMigrations();

    const { AppModule } = await import('../src/app.module');
    const { BadRequestException, ValidationPipe } = await import('@nestjs/common');
    const { HttpAdapterHost } = await import('@nestjs/core');
    const { SwaggerModule, DocumentBuilder } = await import('@nestjs/swagger');

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const nestApp = moduleFixture.createNestApplication();
    nestApp.setGlobalPrefix('api', { exclude: ['health'] });
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
    const swaggerDoc = SwaggerModule.createDocument(
      nestApp,
      new DocumentBuilder().setTitle('Frontend API').setVersion('1').build(),
    );
    SwaggerModule.setup('api/docs', nestApp, swaggerDoc);
    await nestApp.init();
    app = nestApp;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    if (ds?.isInitialized) await ds.destroy();
    await redisContainer?.stop();
    await pgContainer?.stop();
  }, 30_000);

  it('GET /api/docs returns 200 and Swagger UI HTML', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/docs')
      .expect(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('swagger');
  });

  it('POST /api/test-validation returns VALIDATION_ERROR and envelope with details for invalid body', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/test-validation')
      .send({})
      .expect((r: { status: number }) => {
        expect([400, 422]).toContain(r.status);
      });

    const body = res.body as { error?: { code?: string; message?: string; details?: Record<string, string> } };
    expect(body.error).toBeDefined();
    expect(body.error?.code).toBe('VALIDATION_ERROR');
    expect(body.error?.message).toBeDefined();
    expect(body.error?.details).toBeDefined();
    expect(typeof body.error?.details).toBe('object');
    expect(Object.keys(body.error?.details ?? {}).length).toBeGreaterThan(0);
  });
});

describe('Frontend API E2E (counters)', () => {
  let pgContainer: Awaited<ReturnType<PostgreSqlContainer['start']>>;
  let redisContainer: Awaited<ReturnType<RedisContainer['start']>>;
  let app: { getHttpServer: () => unknown; close: () => Promise<void> };
  let ds: DataSource;
  let seededUser: User;
  let seededGuild: Guild;

  beforeAll(async () => {
    pgContainer = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('test')
      .withUsername('postgres')
      .withPassword('postgres')
      .start();
    redisContainer = await new RedisContainer('redis:7-alpine').start();

    const { setTestIntegrationEnv } = await import('@app/shared/test-integration-env');
    setTestIntegrationEnv({
      NODE_ENV: 'test',
      POSTGRES_HOST: pgContainer.getHost(),
      POSTGRES_PORT: pgContainer.getPort(),
      POSTGRES_USER: pgContainer.getUsername(),
      POSTGRES_PASSWORD: pgContainer.getPassword(),
      POSTGRES_DB: pgContainer.getDatabase(),
      REDIS_HOST: redisContainer.getHost(),
      REDIS_PORT: redisContainer.getPort(),
    });

    const {
      Guild,
      GuildStatus,
      GuildSubscriptionTier,
      User,
      UserPlan,
      UserStatus,
      AllExceptionsFilter,
    } = await import('@app/shared');

    const mockGuildsService: Partial<GuildsService> = {
      findGuildByDiscordId: async (discordGuildId: string) =>
        discordGuildId === seededGuild.discordGuildId ? seededGuild : null,
      userHasGuildAdmin: async (userId: string, discordGuildId: string) =>
        userId === seededUser.id && discordGuildId === seededGuild.discordGuildId,
    };

    const mockJwtAuthGuard = {
      canActivate: (context: ExecutionContext): boolean => {
        const req = context.switchToHttp().getRequest();
        req.user = seededUser;
        return true;
      },
    };

    const { AppModule } = await import('../src/app.module');
    const { BadRequestException, ValidationPipe } = await import('@nestjs/common');
    const { HttpAdapterHost } = await import('@nestjs/core');
    const { DataSource: TypeOrmDataSource } = await import('typeorm');

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GuildsService)
      .useValue(mockGuildsService)
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    const nestApp = moduleFixture.createNestApplication();
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
    await ds.runMigrations();

    const userRepo = ds.getRepository(User);
    const guildRepo = ds.getRepository(Guild);
    const user = await userRepo.save(
      userRepo.create({
        username: 'e2e-counter-user',
        plan: UserPlan.FREE,
        status: UserStatus.ACTIVE,
      }),
    );
    seededUser = user;
    const discordGuildId = String(111222333444555666n + BigInt(Date.now() % 1000000));
    const guild = await guildRepo.save(
      guildRepo.create({
        discordGuildId,
        name: 'E2E Test Guild',
        ownerId: user.id,
        status: GuildStatus.ACTIVE,
        subscriptionTier: GuildSubscriptionTier.FREE,
        memberCount: 0,
        messageCount: '0',
        isBotInGuild: false,
      }),
    );
    seededGuild = guild;

    (mockGuildsService.findGuildByDiscordId as (id: string) => Promise<Guild | null>) = async (discordGuildId: string) => {
      if (discordGuildId === seededGuild.discordGuildId) return seededGuild;
      if (discordGuildId === '999888777666555444') return { ...seededGuild, discordGuildId: '999888777666555444' } as Guild;
      return null;
    };
    (mockGuildsService.userHasGuildAdmin as (userId: string, discordGuildId: string) => Promise<boolean>) = async (userId: string, discordGuildId: string) =>
      userId === seededUser.id && discordGuildId === seededGuild.discordGuildId;
    (mockJwtAuthGuard.canActivate as (context: ExecutionContext) => boolean) = (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = seededUser;
      return true;
    };
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    if (ds?.isInitialized) await ds.destroy();
    await redisContainer?.stop();
    await pgContainer?.stop();
  }, 30_000);

  it('POST /api/guilds/:guildId/counters creates counter and returns 201 with envelope', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/guilds/${seededGuild.discordGuildId}/counters`)
      .set('Authorization', 'Bearer e2e-test-token')
      .send({
        channelId: '987654321098765432',
        type: 'stat',
        metric: 'members',
        template: 'Members: {count}',
      })
      .expect(201);

    const body = res.body as { data?: { id?: string; channelId?: string; template?: string; type?: string; metric?: string; status?: string } };
    expect(body.data).toBeDefined();
    expect(body.data?.id).toBeDefined();
    expect(body.data?.channelId).toBe('987654321098765432');
    expect(body.data?.template).toBe('Members: {count}');
    expect(body.data?.type).toBe('stat');
    expect(body.data?.metric).toBe('members');
    expect(body.data?.status).toBe('active');
  });

  it('POST /api/guilds/:guildId/counters returns 403 FORBIDDEN when user has no admin on guild', async () => {
    const otherGuildId = '999888777666555444';
    const res = await request(app.getHttpServer())
      .post(`/api/guilds/${otherGuildId}/counters`)
      .set('Authorization', 'Bearer e2e-test-token')
      .send({
        channelId: '987654321098765432',
        type: 'stat',
        metric: 'members',
        template: 'Members: {count}',
      })
      .expect(403);

    const body = res.body as { error?: { code?: string; message?: string } };
    expect(body.error).toBeDefined();
    expect(body.error?.code).toBe('FORBIDDEN');
    expect(body.error?.message).toBeDefined();
  });

  it('PATCH /api/guilds/:guildId/logs/settings returns 403 FORBIDDEN when user has no admin on guild', async () => {
    const otherGuildId = '999888777666555444';
    const res = await request(app.getHttpServer())
      .patch(`/api/guilds/${otherGuildId}/logs/settings`)
      .set('Authorization', 'Bearer e2e-test-token')
      .send({
        settings: [
          { eventType: 'member_join', channelId: '987654321098765432', enabled: true },
        ],
      })
      .expect(403);

    const body = res.body as { error?: { code?: string; message?: string } };
    expect(body.error).toBeDefined();
    expect(body.error?.code).toBe('FORBIDDEN');
    expect(body.error?.message).toBeDefined();
  });

  it('GET /api/guilds/:guildId/settings returns 404 GUILD_NOT_FOUND when guild does not exist', async () => {
    const unknownGuildId = '111222333444555000';
    const res = await request(app.getHttpServer())
      .get(`/api/guilds/${unknownGuildId}/settings`)
      .set('Authorization', 'Bearer e2e-test-token')
      .expect(404);

    const body = res.body as { error?: { code?: string; message?: string } };
    expect(body.error).toBeDefined();
    expect(body.error?.code).toBe('GUILD_NOT_FOUND');
    expect(body.error?.message).toBeDefined();
  });

  it('PATCH /api/guilds/:guildId/logs/settings returns 400 VALIDATION_ERROR when channelId is invalid', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/guilds/${seededGuild.discordGuildId}/logs/settings`)
      .set('Authorization', 'Bearer e2e-test-token')
      .send({
        settings: [
          { eventType: 'member_join', channelId: 'not-a-snowflake', enabled: true },
        ],
      })
      .expect(400);

    const body = res.body as { error?: { code?: string; message?: string; details?: Record<string, string> } };
    expect(body.error).toBeDefined();
    expect(body.error?.code).toBe('VALIDATION_ERROR');
    expect(body.error?.details ?? body.error?.message).toBeDefined();
  });
});

describe('Frontend API E2E (analytics)', () => {
  let pgContainer: Awaited<ReturnType<PostgreSqlContainer['start']>>;
  let redisContainer: Awaited<ReturnType<RedisContainer['start']>>;
  let chContainer: Awaited<ReturnType<ClickHouseContainer['start']>>;
  let app: { getHttpServer: () => unknown; close: () => Promise<void> };
  let ds: DataSource;
  let seededUser: User;
  let seededGuild: Guild;

  beforeAll(async () => {
    pgContainer = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('test')
      .withUsername('postgres')
      .withPassword('postgres')
      .start();
    redisContainer = await new RedisContainer('redis:7-alpine').start();
    chContainer = await new ClickHouseContainer('clickhouse/clickhouse-server:22-alpine').start();

    const chOpts = chContainer.getClientOptions();
    const chUrl = chOpts.url ?? 'http://localhost:8123';
    const { host: chHost, port: chPort } = parseChUrl(chUrl);

    const { setTestIntegrationEnv } = await import('@app/shared/test-integration-env');
    setTestIntegrationEnv({
      NODE_ENV: 'test',
      POSTGRES_HOST: pgContainer.getHost(),
      POSTGRES_PORT: pgContainer.getPort(),
      POSTGRES_USER: pgContainer.getUsername(),
      POSTGRES_PASSWORD: pgContainer.getPassword(),
      POSTGRES_DB: pgContainer.getDatabase(),
      REDIS_HOST: redisContainer.getHost(),
      REDIS_PORT: redisContainer.getPort(),
      CLICKHOUSE_HOST: chHost,
      CLICKHOUSE_PORT: chPort,
      CLICKHOUSE_USER: chOpts.username ?? 'default',
      CLICKHOUSE_PASSWORD: chOpts.password ?? 'default',
      CLICKHOUSE_DB: chOpts.database ?? 'default',
    });

    const {
      Guild,
      GuildStatus,
      GuildSubscriptionTier,
      User,
      UserPlan,
      UserStatus,
      AllExceptionsFilter,
    } = await import('@app/shared');

    const mockGuildsService: Partial<GuildsService> = {
      findGuildByDiscordId: async () => null,
      userHasGuildAdmin: async () => false,
      getSettings: async () =>
        ({
          serverName: '',
          serverDescription: null,
          language: '',
          timezone: 'UTC',
          hasToken: false,
          botConnected: false,
          botUserId: null,
          lastConnected: null,
          dataRetentionDays: 30,
          anonymizeUserData: false,
          shareAnalytics: false,
          allowPublicWidgets: false,
          modules: [],
        }) as Awaited<ReturnType<GuildsService['getSettings']>>,
    };

    const mockJwtAuthGuard = {
      canActivate: (context: ExecutionContext): boolean => {
        const req = context.switchToHttp().getRequest();
        req.user = seededUser;
        return true;
      },
    };

    const { AppModule } = await import('../src/app.module');
    const { BadRequestException, ValidationPipe } = await import('@nestjs/common');
    const { HttpAdapterHost } = await import('@nestjs/core');
    const { DataSource: TypeOrmDataSource } = await import('typeorm');

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GuildsService)
      .useValue(mockGuildsService)
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    const nestApp = moduleFixture.createNestApplication();
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
    await ds.runMigrations();

    const userRepo = ds.getRepository(User);
    const guildRepo = ds.getRepository(Guild);
    const user = await userRepo.save(
      userRepo.create({
        username: 'e2e-analytics-user',
        plan: UserPlan.FREE,
        status: UserStatus.ACTIVE,
      }),
    );
    seededUser = user;
    const discordGuildId = String(111222333444555666n + BigInt(Date.now() % 1000000));
    const guild = await guildRepo.save(
      guildRepo.create({
        discordGuildId,
        name: 'E2E Analytics Guild',
        ownerId: user.id,
        status: GuildStatus.ACTIVE,
        subscriptionTier: GuildSubscriptionTier.FREE,
        memberCount: 0,
        messageCount: '0',
        isBotInGuild: false,
      }),
    );
    seededGuild = guild;

    (mockGuildsService.findGuildByDiscordId as (id: string) => Promise<Guild | null>) = async (discordGuildId: string) =>
      discordGuildId === seededGuild.discordGuildId ? seededGuild : null;
    (mockGuildsService.userHasGuildAdmin as (userId: string, discordGuildId: string) => Promise<boolean>) = async (userId: string, discordGuildId: string) =>
      userId === seededUser.id && discordGuildId === seededGuild.discordGuildId;
    (mockJwtAuthGuard.canActivate as (context: ExecutionContext) => boolean) = (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = seededUser;
      return true;
    };
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    if (ds?.isInitialized) await ds.destroy();
    await chContainer?.stop();
    await redisContainer?.stop();
    await pgContainer?.stop();
  }, 30_000);

  it('GET /api/guilds/:guildId/analytics/overview returns data envelope with totalMessages, activeMembers24h, activeMembers7d', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/guilds/${seededGuild.discordGuildId}/analytics/overview`)
      .set('Authorization', 'Bearer e2e-test-token')
      .expect(200);

    const body = res.body as {
      data?: { totalMessages?: number; activeMembers24h?: number; activeMembers7d?: number };
    };
    expect(body.data).toBeDefined();
    expect(typeof body.data?.totalMessages).toBe('number');
    expect(typeof body.data?.activeMembers24h).toBe('number');
    expect(typeof body.data?.activeMembers7d).toBe('number');
  });

  it('GET /api/guilds/:guildId/analytics/activity-chart returns data array for chart', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/guilds/${seededGuild.discordGuildId}/analytics/activity-chart`)
      .query({ from: '2025-01-01', to: '2025-01-31' })
      .set('Authorization', 'Bearer e2e-test-token')
      .expect(200);

    const body = res.body as { data?: Array<{ date: string; messages: number; members: number; voiceMinutes: number }> };
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    body.data?.forEach((point) => {
      expect(point).toHaveProperty('date');
      expect(point).toHaveProperty('messages');
      expect(point).toHaveProperty('members');
      expect(point).toHaveProperty('voiceMinutes');
    });
  });

  it('GET /api/guilds/:guildId/analytics/top-members returns data array for leaderboard', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/guilds/${seededGuild.discordGuildId}/analytics/top-members`)
      .query({ sortBy: 'messages', limit: 10 })
      .set('Authorization', 'Bearer e2e-test-token')
      .expect(200);

    const body = res.body as {
      data?: Array<{ id: string; username: string; messages: number; voiceMinutes: number }>;
    };
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    body.data?.forEach((row) => {
      expect(row).toHaveProperty('id');
      expect(row).toHaveProperty('username');
      expect(row).toHaveProperty('messages');
      expect(row).toHaveProperty('voiceMinutes');
    });
  });
});

describe('Frontend API E2E (GDPR delete)', () => {
  let pgContainer: Awaited<ReturnType<PostgreSqlContainer['start']>>;
  let redisContainer: Awaited<ReturnType<RedisContainer['start']>>;
  let app: { getHttpServer: () => unknown; close: () => Promise<void> };
  let ds: DataSource;
  let seededUser: User;
  let jwtToken: string;

  beforeAll(async () => {
    pgContainer = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('test')
      .withUsername('postgres')
      .withPassword('postgres')
      .start();
    redisContainer = await new RedisContainer('redis:7-alpine').start();

    const { setTestIntegrationEnv } = await import('@app/shared/test-integration-env');
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
      JWT_SECRET: 'e2e-gdpr-jwt-secret',
    });

    const {
      Guild,
      GuildStatus,
      GuildSubscriptionTier,
      User,
      UserPlan,
      UserStatus,
      AllExceptionsFilter,
    } = await import('@app/shared');
    const { JwtService } = await import('@nestjs/jwt');

    const { AppModule } = await import('../src/app.module');
    const { BadRequestException, ValidationPipe } = await import('@nestjs/common');
    const { HttpAdapterHost } = await import('@nestjs/core');
    const { DataSource: TypeOrmDataSource } = await import('typeorm');

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const nestApp = moduleFixture.createNestApplication();
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
    await ds.runMigrations();

    const userRepo = ds.getRepository(User);
    const guildRepo = ds.getRepository(Guild);
    const discordId = String(111222333444555666n + BigInt(Date.now() % 1000000000));
    const user = await userRepo.save(
      userRepo.create({
        discordId,
        username: 'e2e-gdpr-delete-user',
        plan: UserPlan.FREE,
        status: UserStatus.ACTIVE,
      }),
    );
    seededUser = user;
    const discordGuildId = String(999888777666555444n + BigInt(Date.now() % 1000000));
    await guildRepo.save(
      guildRepo.create({
        discordGuildId,
        name: 'E2E GDPR Guild',
        ownerId: user.id,
        status: GuildStatus.ACTIVE,
        subscriptionTier: GuildSubscriptionTier.FREE,
        memberCount: 0,
        messageCount: '0',
        isBotInGuild: false,
      }),
    );

    const { SharedConfigService } = await import('@app/shared');
    const sharedConfig = nestApp.get(SharedConfigService);
    const jwtService = nestApp.get(JwtService);
    jwtToken = jwtService.sign(
      { sub: user.id },
      { secret: sharedConfig.auth.jwtSecret, expiresIn: '1h' },
    );
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    if (ds?.isInitialized) await ds.destroy();
    await redisContainer?.stop();
    await pgContainer?.stop();
  }, 30_000);

  it('DELETE /api/users/me/data removes user; subsequent request with same JWT returns 401 and user is gone from DB', async () => {
    await request(app.getHttpServer())
      .delete('/api/users/me/data')
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(204);

    const protectedRes = await request(app.getHttpServer())
      .get('/api/users/me/data/export')
      .set('Authorization', `Bearer ${jwtToken}`);
    expect(protectedRes.status).toBe(401);

    const userRepo = ds.getRepository(User);
    const userAfter = await userRepo.findOne({ where: { id: seededUser.id } });
    expect(userAfter).toBeNull();
  });
});
