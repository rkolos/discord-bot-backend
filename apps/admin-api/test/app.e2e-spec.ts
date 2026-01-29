import { ClickHouseContainer } from '@testcontainers/clickhouse';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { Test } from '@nestjs/testing';
import { join } from 'path';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
const request = require('supertest');

function parseHttpUrl(url: string): { host: string; port: number } {
  const u = new URL(url);
  return { host: u.hostname, port: parseInt(u.port || '8123', 10) };
}

describe('Admin API E2E (validation contract)', () => {
  let pgContainer: Awaited<ReturnType<PostgreSqlContainer['start']>>;
  let redisContainer: Awaited<ReturnType<RedisContainer['start']>>;
  let chContainer: Awaited<ReturnType<ClickHouseContainer['start']>>;
  let app: { getHttpServer: () => unknown; close: () => Promise<void> };
  let ds: DataSource;

  beforeAll(async () => {
    pgContainer = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('test')
      .withUsername('postgres')
      .withPassword('postgres')
      .start();
    redisContainer = await new RedisContainer('redis:7-alpine').start();
    chContainer = await new ClickHouseContainer('clickhouse/clickhouse-server:22-alpine').start();

    const opts = chContainer.getClientOptions();
    const chUrl = opts.url ?? 'http://localhost:8123';
    const { host: chHost, port: chPort } = parseHttpUrl(chUrl);

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
      CLICKHOUSE_USER: opts.username ?? 'default',
      CLICKHOUSE_PASSWORD: opts.password ?? 'default',
      CLICKHOUSE_DB: opts.database ?? 'default',
    });

    const {
      ActivityLog,
      AdminRefreshToken,
      AdminUser,
      AdminUserRole,
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
      AdminRefreshToken,
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

    const adminRepo = ds.getRepository(AdminUser);
    const passwordHash = await bcrypt.hash('adminpassword', 10);
    await adminRepo.save(
      adminRepo.create({
        email: 'admin@admin.com',
        name: 'adminname',
        role: AdminUserRole.SUPER_ADMIN,
        passwordHash,
      }),
    );

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
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    if (ds?.isInitialized) await ds.destroy();
    await chContainer?.stop();
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

  it('POST /api/auth/login returns accessToken and user for valid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@admin.com', password: 'adminpassword' })
      .expect(200);

    const body = res.body as {
      data?: { accessToken?: string; user?: { id: string; email: string; name: string; role: string } };
    };
    expect(body.data).toBeDefined();
    expect(body.data?.accessToken).toBeDefined();
    expect(typeof body.data?.accessToken).toBe('string');
    expect(body.data?.user).toBeDefined();
    expect(body.data?.user?.email).toBe('admin@admin.com');
    expect(body.data?.user?.name).toBe('adminname');
    expect(body.data?.user?.role).toBe('super_admin');
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'].some((c: string) => c.includes('refresh_token'))).toBe(true);
  });

  it('POST /api/auth/login returns INVALID_CREDENTIALS for wrong password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@admin.com', password: 'wrongpassword' })
      .expect(401);

    const body = res.body as { error?: { code?: string; message?: string } };
    expect(body.error?.code).toBe('INVALID_CREDENTIALS');
  });

  it('GET /api/admin/stats/growth returns timeSeries with date, totalGuilds, totalUsers', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@admin.com', password: 'adminpassword' })
      .expect(200);
    const token = (loginRes.body as { data?: { accessToken?: string } }).data?.accessToken;
    expect(token).toBeDefined();

    const res = await request(app.getHttpServer())
      .get('/api/admin/stats/growth')
      .query({ from: '2020-01-01', to: '2030-01-01' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = res.body as {
      data?: { timeSeries?: Array<{ date: string; totalGuilds: number; totalUsers: number }> };
    };
    expect(body.data).toBeDefined();
    expect(body.data?.timeSeries).toBeDefined();
    expect(Array.isArray(body.data?.timeSeries)).toBe(true);
    body.data?.timeSeries?.forEach((point) => {
      expect(point).toHaveProperty('date');
      expect(point).toHaveProperty('totalGuilds');
      expect(point).toHaveProperty('totalUsers');
      expect(typeof point.totalGuilds).toBe('number');
      expect(typeof point.totalUsers).toBe('number');
    });
  });
});
