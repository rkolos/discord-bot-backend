/**
 * E2E: симуляция события (добавление задачи в очередь счётчиков), проверка обработки и вызова Discord API.
 * Мокаем HttpService (REST PATCH канала), репозитории и Redis.
 */
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { AppModule } from '../src/app.module';
import { ShardingManagerService } from '../src/sharding/sharding-manager.service';
import { SharedAnalyticsService } from '@app/shared';
import { Counter, CounterMetric, CounterType, CounterStatus, Guild } from '@app/shared';
import { CountersQueueProducerService } from '../src/counters-queue-producer/counters-queue-producer.service';
import { RedisService } from '@app/shared';
import { MultiTokenConnectionManagerService } from '../src/multi-token/multi-token-connection-manager.service';

describe('Bot-service E2E (counters queue and Discord API)', () => {
  let app: INestApplication;
  let countersProducer: CountersQueueProducerService;
  let httpPatchMock: jest.Mock;

  const guildIdUuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const discordGuildId = '123456789012345678';
  const channelId = '987654321098765432';

  const mockCounter: Partial<Counter> = {
    id: 'counter-uuid-e2e',
    guildId: guildIdUuid,
    channelId,
    channelName: 'Members: 0',
    type: CounterType.STAT,
    metric: CounterMetric.MEMBERS,
    template: 'Members: {count}',
    status: CounterStatus.ACTIVE,
    currentValue: null,
    target: null,
    timezone: null,
    dateFormat: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockGuild = { id: guildIdUuid, discordGuildId };

  beforeAll(async () => {
    process.env['DISCORD_BOT_TOKEN'] = 'e2e-mock-token';
    httpPatchMock = jest.fn().mockReturnValue(of({ status: 200, data: {}, headers: {} }));

    const mockCounterRepo = {
      findOne: jest.fn().mockResolvedValue(mockCounter),
      find: jest.fn().mockResolvedValue([mockCounter]),
      save: jest.fn().mockResolvedValue(mockCounter),
    };
    const mockGuildRepo = {
      findOne: jest.fn().mockResolvedValue(mockGuild),
    };
    const mockRedisClient = {
      get: jest.fn().mockResolvedValue('100'),
      set: jest.fn().mockResolvedValue('OK'),
      lrange: jest.fn().mockResolvedValue([]),
      lpush: jest.fn().mockResolvedValue(1),
      ltrim: jest.fn().mockResolvedValue('OK'),
      expire: jest.fn().mockResolvedValue(1),
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
      .useValue({
        getOverviewByGuildId: jest.fn().mockResolvedValue({ totalMessages: 0, activeMembers24h: 0, activeMembers7d: 0 }),
      })
      .overrideProvider(getRepositoryToken(Counter))
      .useValue(mockCounterRepo)
      .overrideProvider(getRepositoryToken(Guild))
      .useValue(mockGuildRepo)
      .overrideProvider(HttpService)
      .useValue({ patch: httpPatchMock })
      .overrideProvider(RedisService)
      .useValue({ getClient: () => mockRedisClient })
      .overrideProvider(MultiTokenConnectionManagerService)
      .useValue({
        getClientForGuild: jest.fn().mockReturnValue(null),
        hasCustomTokenForGuild: jest.fn().mockReturnValue(false),
        getTokenKindForGuild: jest.fn().mockReturnValue('main'),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    countersProducer = moduleRef.get(CountersQueueProducerService);
  });

  afterAll(async () => {
    delete process.env['DISCORD_BOT_TOKEN'];
    await app.close();
  });

  it('adds counter update job and consumer calls Discord PATCH channel with formatted name', async () => {
    httpPatchMock.mockClear();

    await countersProducer.addCounterUpdatesForGuildMembers(guildIdUuid);

    await new Promise((r) => setTimeout(r, 3000));

    expect(httpPatchMock).toHaveBeenCalled();
    const call = httpPatchMock.mock.calls[0];
    expect(call[0]).toContain(`/channels/${channelId}`);
    expect(call[1]).toEqual({ name: 'Members: 100' });
  }, 15000);
});
