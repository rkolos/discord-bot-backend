import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { Repository } from 'typeorm';
import { Counter, CounterMetric, CounterStatus, CounterType, Guild, RedisService, SharedAnalyticsService, SharedConfigService } from '@app/shared';
import { MultiTokenConnectionManagerService } from '../multi-token/multi-token-connection-manager.service';
import { CountersConsumerService } from './counters-consumer.service';
import { ConfigService } from '@nestjs/config';

const mockWorker = { on: jest.fn(), close: jest.fn().mockResolvedValue(undefined) };
jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => mockWorker),
}));

describe('CountersConsumerService', () => {
  let service: CountersConsumerService;
  let counterRepo: jest.Mocked<Pick<Repository<Counter>, 'findOne' | 'save'>>;
  let guildRepo: jest.Mocked<Pick<Repository<Guild>, 'findOne'>>;
  let redisClient: {
    get: jest.Mock;
    set: jest.Mock;
    lrange: jest.Mock;
    lpush: jest.Mock;
    ltrim: jest.Mock;
    expire: jest.Mock;
    hgetall: jest.Mock;
    hget: jest.Mock;
  };
  let multiToken: jest.Mocked<Pick<MultiTokenConnectionManagerService, 'getClientForGuild'>>;
  let httpService: jest.Mocked<Pick<HttpService, 'patch'>>;
  let sharedAnalytics: jest.Mocked<Pick<SharedAnalyticsService, 'getOverviewByGuildId'>>;

  const guildIdUuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const discordGuildId = '123456789';
  const channelId = '987654321';
  const counterId = 'counter-uuid-1';

  const counterEntity: Partial<Counter> = {
    id: counterId,
    guildId: guildIdUuid,
    channelId,
    channelName: 'Members: 0',
    type: CounterType.STAT,
    metric: CounterMetric.MEMBERS,
    roleId: null,
    template: 'Members: {count}',
    status: CounterStatus.ACTIVE,
    currentValue: null,
    target: null,
    timezone: null,
    dateFormat: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const guildEntity = { id: guildIdUuid, discordGuildId };

  beforeEach(async () => {
    redisClient = {
      get: jest.fn().mockResolvedValue('100'),
      set: jest.fn().mockResolvedValue('OK'),
      lrange: jest.fn().mockResolvedValue([]),
      lpush: jest.fn().mockResolvedValue(1),
      ltrim: jest.fn().mockResolvedValue('OK'),
      expire: jest.fn().mockResolvedValue(1),
      hgetall: jest.fn().mockResolvedValue({}),
      hget: jest.fn().mockResolvedValue(null),
    };
    multiToken = { getClientForGuild: jest.fn().mockReturnValue(null) };
    httpService = { patch: jest.fn().mockReturnValue(of({ status: 200, data: {}, headers: {} })) };
    sharedAnalytics = { getOverviewByGuildId: jest.fn().mockResolvedValue({ totalMessages: 50, activeMembers24h: 10, activeMembers7d: 20 }) };

    counterRepo = {
      findOne: jest.fn().mockResolvedValue(counterEntity),
      save: jest.fn().mockResolvedValue(counterEntity),
    };
    guildRepo = { findOne: jest.fn().mockResolvedValue(guildEntity) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CountersConsumerService,
        { provide: getRepositoryToken(Counter), useValue: counterRepo },
        { provide: getRepositoryToken(Guild), useValue: guildRepo },
        { provide: SharedConfigService, useValue: { redis: { prefix: 'sn:test:' } } },
        {
          provide: RedisService,
          useValue: { getClient: () => redisClient },
        },
        { provide: MultiTokenConnectionManagerService, useValue: multiToken },
        { provide: HttpService, useValue: httpService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('main-bot-token') } },
        { provide: SharedAnalyticsService, useValue: sharedAnalytics },
      ],
    }).compile();

    service = module.get(CountersConsumerService);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('processes job: loads counter and guild, gets metric from Redis for MEMBERS', async () => {
    const processJob = (service as unknown as { processJob: (j: { data: unknown }) => Promise<void> }).processJob.bind(service);
    await processJob({
      data: {
        counter_id: counterId,
        guild_id: guildIdUuid,
        channel_id: channelId,
        type: 'stat',
        metric: CounterMetric.MEMBERS,
      },
    });
    expect(counterRepo.findOne).toHaveBeenCalledWith({
      where: { id: counterId },
      relations: ['guild'],
    });
    expect(guildRepo.findOne).toHaveBeenCalledWith({
      where: { id: guildIdUuid },
      select: ['id', 'discordGuildId'],
    });
    expect(redisClient.get).toHaveBeenCalled();
    expect(httpService.patch).toHaveBeenCalledWith(
      expect.stringContaining(`/channels/${channelId}`),
      { name: 'Members: 100' },
      expect.any(Object),
    );
  });

  it('uses custom client when getClientForGuild returns client (multi-bot)', async () => {
    const mockChannel = { setName: jest.fn().mockResolvedValue(undefined) };
    const mockClient = {
      channels: { fetch: jest.fn().mockResolvedValue(mockChannel) },
    };
    multiToken.getClientForGuild.mockReturnValue(mockClient as unknown as import('discord.js').Client);

    const processJob = (service as unknown as { processJob: (j: { data: unknown }) => Promise<void> }).processJob.bind(service);
    await processJob({
      data: {
        counter_id: counterId,
        guild_id: guildIdUuid,
        channel_id: channelId,
        type: 'stat',
        metric: CounterMetric.MEMBERS,
      },
    });
    expect(mockClient.channels.fetch).toHaveBeenCalledWith(channelId);
    expect(mockChannel.setName).toHaveBeenCalledWith('Members: 100');
    expect(httpService.patch).not.toHaveBeenCalled();
  });

  it('skips update when rate limit exceeded (two timestamps in window)', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    redisClient.lrange.mockResolvedValue([String(nowSec - 60), String(nowSec - 120)]);

    const processJob = (service as unknown as { processJob: (j: { data: unknown }) => Promise<void> }).processJob.bind(service);
    await processJob({
      data: {
        counter_id: counterId,
        guild_id: guildIdUuid,
        channel_id: channelId,
        type: 'stat',
        metric: CounterMetric.MEMBERS,
      },
    });
    expect(httpService.patch).not.toHaveBeenCalled();
  });

  it('completes without error when counter not found', async () => {
    counterRepo.findOne.mockResolvedValue(null);
    const processJob = (service as unknown as { processJob: (j: { data: unknown }) => Promise<void> }).processJob.bind(service);
    await processJob({
      data: {
        counter_id: 'missing',
        guild_id: guildIdUuid,
        channel_id: channelId,
        type: 'stat',
        metric: CounterMetric.MEMBERS,
      },
    });
    expect(guildRepo.findOne).not.toHaveBeenCalled();
    expect(httpService.patch).not.toHaveBeenCalled();
  });

  it('processes ROLE metric: reads count from Redis and updates channel name', async () => {
    const roleId = '111222333444555777';
    counterRepo.findOne.mockResolvedValue({
      ...counterEntity,
      id: counterId,
      guildId: guildIdUuid,
      metric: CounterMetric.ROLE,
      roleId,
      template: 'Admins: {count}',
      channelName: 'Admins: 0',
    } as Counter);
    redisClient.hget.mockResolvedValue('4');

    const processJob = (service as unknown as { processJob: (j: { data: unknown }) => Promise<void> }).processJob.bind(service);
    await processJob({
      data: {
        counter_id: counterId,
        guild_id: guildIdUuid,
        channel_id: channelId,
        type: 'stat',
        metric: CounterMetric.ROLE,
        role_id: roleId,
      },
    });

    expect(redisClient.hget).toHaveBeenCalledWith(
      expect.stringContaining('role_counts'),
      roleId,
    );
    expect(httpService.patch).toHaveBeenCalledWith(
      expect.stringContaining(`/channels/${channelId}`),
      { name: 'Admins: 4' },
      expect.any(Object),
    );
  });
});
