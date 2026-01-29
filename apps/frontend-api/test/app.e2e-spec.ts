import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { Test } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { GuildsService } from '../src/guilds/guilds.service';
import { Guild } from '@app/shared';
import { User } from '@app/shared';
const request = require('supertest');

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
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    if (ds?.isInitialized) await ds.destroy();
    await redisContainer?.stop();
    await pgContainer?.stop();
  }, 30_000);

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
    const guild = await guildRepo.save(
      guildRepo.create({
        discordGuildId: '111222333444555666',
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

    (mockGuildsService.findGuildByDiscordId as (id: string) => Promise<Guild | null>) = async (discordGuildId: string) =>
      discordGuildId === seededGuild.discordGuildId ? seededGuild : null;
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
});
