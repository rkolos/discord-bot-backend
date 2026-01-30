/**
 * E2E: запуск bot-service, проверка внутренних эндпоинтов (analytics overview, commands register).
 * Sharding отключён через мок, чтобы не подключаться к Discord.
 */
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { ShardingManagerService } from '../src/sharding/sharding-manager.service';
import { SharedAnalyticsService } from '@app/shared';
import * as request from 'supertest';

describe('Bot-service E2E (internal endpoints)', () => {
  let app: INestApplication;
  let sharedAnalytics: jest.Mocked<Pick<SharedAnalyticsService, 'getOverviewByGuildId'>>;

  const guildId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  beforeAll(async () => {
    const mockSharedAnalytics = {
      getOverviewByGuildId: jest.fn().mockResolvedValue({
        totalMessages: 10,
        activeMembers24h: 2,
        activeMembers7d: 5,
      }),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ShardingManagerService)
      .useValue({
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
        getManager: () => null,
        isGatewayReady: () => false,
      })
      .overrideProvider(SharedAnalyticsService)
      .useValue(mockSharedAnalytics)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    sharedAnalytics = moduleRef.get(SharedAnalyticsService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /internal/analytics/overview', () => {
    it('returns overview when guildId is valid and guard passes', async () => {
      const res = await request(app.getHttpServer())
        .get(`/internal/analytics/overview?guildId=${guildId}`)
        .expect(200);

      const body = res.body as { totalMessages: number; activeMembers24h: number; activeMembers7d: number };
      expect(body.totalMessages).toBe(10);
      expect(body.activeMembers24h).toBe(2);
      expect(body.activeMembers7d).toBe(5);
      expect(sharedAnalytics.getOverviewByGuildId).toHaveBeenCalledWith(guildId);
    });
  });

  describe('POST /internal/commands/register', () => {
    it('accepts valid body and returns ok', async () => {
      const token = 'mock-token-for-e2e';
      const originalFetch = global.fetch;
      (global as unknown as { fetch: typeof fetch }).fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'app-e2e' }),
        })
        .mockResolvedValueOnce({ ok: true });

      const res = await request(app.getHttpServer())
        .post('/internal/commands/register')
        .send({ token, scope: 'global' })
        .expect(201);

      const body = res.body as { ok?: boolean };
      expect(body.ok).toBe(true);

      (global as unknown as { fetch: typeof fetch }).fetch = originalFetch;
    });
  });
});
