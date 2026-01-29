import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClickHouseService } from '@app/shared';
import { SharedConfigService } from '@app/shared';
import { GuildSubscriptionTier } from '@app/shared';
import { GuildsService } from '../guilds/guilds.service';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let clickhouse: jest.Mocked<Pick<ClickHouseService, 'query'>>;
  let guildsService: jest.Mocked<Pick<GuildsService, 'findGuildByDiscordId'>>;

  const guildId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const discordGuildId = '111222333444555666';

  beforeEach(async () => {
    const mockQuery = jest.fn().mockResolvedValue({
      json: async () => [{ today: '2025-01-15' }, { total: 100 }, { cnt: 5 }, { cnt: 12 }],
    });
    const mockClickhouse = {
      query: mockQuery,
    };
    const mockGuildsService = {
      findGuildByDiscordId: jest.fn(),
    };
    const mockSharedConfig = {
      clickhouse: { database: 'default' },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: ClickHouseService, useValue: mockClickhouse },
        { provide: SharedConfigService, useValue: mockSharedConfig },
        { provide: GuildsService, useValue: mockGuildsService },
      ],
    }).compile();

    service = module.get(AnalyticsService);
    clickhouse = module.get(ClickHouseService);
    guildsService = module.get(GuildsService);
  });

  describe('SQL parameterization', () => {
    it('getActivityChart passes from and to only via query_params', async () => {
      const from = '2025-01-01';
      const to = '2025-01-31';
      (guildsService.findGuildByDiscordId as jest.Mock).mockResolvedValue({
        id: guildId,
        discordGuildId,
        subscriptionTier: GuildSubscriptionTier.PRO,
      });
      (clickhouse.query as jest.Mock).mockResolvedValue({
        json: async () => [
          { date: '2025-01-01', messages: 10, members: 3, voiceMinutes: 0 },
        ],
      });

      await service.getActivityChart(discordGuildId, from, to);

      const call = (clickhouse.query as jest.Mock).mock.calls.find(
        (c: unknown[]) => (c[0] as { query: string }).query?.includes('mv_daily_activity'),
      );
      expect(call).toBeDefined();
      const params = call[0].query_params;
      expect(params).toBeDefined();
      expect(params.from).toBe(from);
      expect(params.to).toBe(to);
      expect(params.guildId).toBe(guildId);
      expect(call[0].query).not.toContain(from);
      expect(call[0].query).not.toContain(to);
    });

    it('getTopMembers passes limit only via query_params', async () => {
      (guildsService.findGuildByDiscordId as jest.Mock).mockResolvedValue({
        id: guildId,
        discordGuildId,
      });
      (clickhouse.query as jest.Mock).mockResolvedValue({
        json: async () => [],
      });

      await service.getTopMembers(discordGuildId, 'messages', 20);

      const call = (clickhouse.query as jest.Mock).mock.calls.find(
        (c: unknown[]) => (c[0] as { query: string }).query?.includes('mv_top_members'),
      );
      expect(call).toBeDefined();
      expect(call[0].query_params?.limit).toBe(20);
      expect(call[0].query_params?.guildId).toBe(guildId);
    });
  });

  describe('Free plan period validation', () => {
    it('throws when Free plan and range exceeds 365 days', async () => {
      (guildsService.findGuildByDiscordId as jest.Mock).mockResolvedValue({
        id: guildId,
        discordGuildId,
        subscriptionTier: GuildSubscriptionTier.FREE,
      });

      await expect(
        service.getActivityChart(discordGuildId, '2024-01-01', '2025-06-01'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.getActivityChart(discordGuildId, '2024-01-01', '2025-06-01'),
      ).rejects.toMatchObject({
        response: {
          code: 'INVALID_DATE_RANGE',
          message: expect.stringContaining('365'),
        },
      });
    });

    it('allows Free plan when range is 365 days or less', async () => {
      (guildsService.findGuildByDiscordId as jest.Mock).mockResolvedValue({
        id: guildId,
        discordGuildId,
        subscriptionTier: GuildSubscriptionTier.FREE,
      });
      (clickhouse.query as jest.Mock).mockResolvedValue({
        json: async () => [],
      });

      await expect(
        service.getActivityChart(discordGuildId, '2024-01-01', '2024-12-31'),
      ).resolves.toEqual([]);
    });
  });

  describe('getOverview', () => {
    it('throws GUILD_NOT_FOUND when guild does not exist', async () => {
      (guildsService.findGuildByDiscordId as jest.Mock).mockResolvedValue(null);

      await expect(service.getOverview(discordGuildId)).rejects.toThrow(NotFoundException);
      await expect(service.getOverview(discordGuildId)).rejects.toMatchObject({
        response: { code: 'GUILD_NOT_FOUND' },
      });
    });
  });

  describe('validateDateRange', () => {
    it('throws when from > to', async () => {
      (guildsService.findGuildByDiscordId as jest.Mock).mockResolvedValue({
        id: guildId,
        discordGuildId,
        subscriptionTier: GuildSubscriptionTier.PRO,
      });

      await expect(
        service.getActivityChart(discordGuildId, '2025-01-31', '2025-01-01'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.getActivityChart(discordGuildId, '2025-01-31', '2025-01-01'),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_DATE_RANGE' },
      });
    });
  });
});
