import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GuildSubscriptionTier } from '@app/shared';
import { SharedAnalyticsService } from '@app/shared';
import { GuildsService } from '../guilds/guilds.service';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let sharedAnalytics: jest.Mocked<Pick<SharedAnalyticsService, 'getOverviewByGuildId' | 'getActivityChartByGuildId' | 'getTopMembersByGuildId'>>;
  let guildsService: jest.Mocked<Pick<GuildsService, 'findGuildByIdOrDiscordId' | 'getSettings'>>;

  const guildId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const discordGuildId = '111222333444555666';

  beforeEach(async () => {
    const mockSharedAnalytics = {
      getOverviewByGuildId: jest.fn(),
      getActivityChartByGuildId: jest.fn(),
      getTopMembersByGuildId: jest.fn(),
    };
    const mockGuildsService = {
      findGuildByIdOrDiscordId: jest.fn(),
      getSettings: jest.fn().mockResolvedValue({ timezone: 'UTC', anonymizeUserData: false }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: SharedAnalyticsService, useValue: mockSharedAnalytics },
        { provide: GuildsService, useValue: mockGuildsService },
      ],
    }).compile();

    service = module.get(AnalyticsService);
    sharedAnalytics = module.get(SharedAnalyticsService);
    guildsService = module.get(GuildsService);
  });

  describe('delegation to SharedAnalyticsService', () => {
    it('getActivityChart calls sharedAnalytics with guild id and date range', async () => {
      const from = '2025-01-01';
      const to = '2025-01-31';
      (guildsService.findGuildByIdOrDiscordId as jest.Mock).mockResolvedValue({
        id: guildId,
        discordGuildId,
        subscriptionTier: GuildSubscriptionTier.PRO,
      });
      (sharedAnalytics.getActivityChartByGuildId as jest.Mock).mockResolvedValue([
        { date: '2025-01-01', messages: 10, members: 3, voiceMinutes: 0 },
      ]);

      await service.getActivityChart(discordGuildId, from, to);

      expect(sharedAnalytics.getActivityChartByGuildId).toHaveBeenCalledWith(
        guildId,
        from,
        to,
        'UTC',
      );
    });

    it('getTopMembers calls sharedAnalytics with guild id, sortBy, limit and anonymizeUserData from settings', async () => {
      (guildsService.findGuildByIdOrDiscordId as jest.Mock).mockResolvedValue({
        id: guildId,
        discordGuildId,
      });
      (guildsService.getSettings as jest.Mock).mockResolvedValue({
        timezone: 'UTC',
        anonymizeUserData: false,
      });
      (sharedAnalytics.getTopMembersByGuildId as jest.Mock).mockResolvedValue([]);

      await service.getTopMembers(discordGuildId, 'messages', 20);

      expect(sharedAnalytics.getTopMembersByGuildId).toHaveBeenCalledWith(
        guildId,
        'messages',
        20,
        { anonymizeUserData: false },
      );
    });

    it('getOverview calls sharedAnalytics with guild id and timezone from settings', async () => {
      (guildsService.findGuildByIdOrDiscordId as jest.Mock).mockResolvedValue({
        id: guildId,
        discordGuildId,
      });
      (guildsService.getSettings as jest.Mock).mockResolvedValue({
        timezone: 'UTC',
        anonymizeUserData: false,
      });
      (sharedAnalytics.getOverviewByGuildId as jest.Mock).mockResolvedValue({
        totalMessages: 100,
        activeMembers24h: 5,
        activeMembers7d: 12,
      });

      const result = await service.getOverview(discordGuildId);

      expect(sharedAnalytics.getOverviewByGuildId).toHaveBeenCalledWith(
        guildId,
        'UTC',
      );
      expect(result).toEqual({
        totalMessages: 100,
        activeMembers24h: 5,
        activeMembers7d: 12,
      });
    });

    it('getOverview uses header timezone over query and settings', async () => {
      (guildsService.findGuildByIdOrDiscordId as jest.Mock).mockResolvedValue({
        id: guildId,
        discordGuildId,
      });
      (sharedAnalytics.getOverviewByGuildId as jest.Mock).mockResolvedValue({
        totalMessages: 0,
        activeMembers24h: 0,
        activeMembers7d: 0,
      });

      await service.getOverview(discordGuildId, {
        headerTimezone: 'Europe/Moscow',
        queryTimezone: 'America/New_York',
      });

      expect(sharedAnalytics.getOverviewByGuildId).toHaveBeenCalledWith(
        guildId,
        'Europe/Moscow',
      );
      expect(guildsService.getSettings).not.toHaveBeenCalled();
    });
  });

  describe('Free plan period validation', () => {
    it('throws when Free plan and range exceeds 365 days', async () => {
      (guildsService.findGuildByIdOrDiscordId as jest.Mock).mockResolvedValue({
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
      expect(sharedAnalytics.getActivityChartByGuildId).not.toHaveBeenCalled();
    });

    it('allows Free plan when range is 365 days or less', async () => {
      (guildsService.findGuildByIdOrDiscordId as jest.Mock).mockResolvedValue({
        id: guildId,
        discordGuildId,
        subscriptionTier: GuildSubscriptionTier.FREE,
      });
      (sharedAnalytics.getActivityChartByGuildId as jest.Mock).mockResolvedValue([]);

      await expect(
        service.getActivityChart(discordGuildId, '2024-01-01', '2024-12-31'),
      ).resolves.toEqual([]);
      expect(sharedAnalytics.getActivityChartByGuildId).toHaveBeenCalledWith(
        guildId,
        '2024-01-01',
        '2024-12-31',
        'UTC',
      );
    });
  });

  describe('getOverview', () => {
    it('throws GUILD_NOT_FOUND when guild does not exist', async () => {
      (guildsService.findGuildByIdOrDiscordId as jest.Mock).mockResolvedValue(null);

      await expect(service.getOverview(discordGuildId)).rejects.toThrow(NotFoundException);
      await expect(service.getOverview(discordGuildId)).rejects.toMatchObject({
        response: { code: 'GUILD_NOT_FOUND' },
      });
      expect(sharedAnalytics.getOverviewByGuildId).not.toHaveBeenCalled();
    });
  });

  describe('validateDateRange', () => {
    it('throws when from > to', async () => {
      (guildsService.findGuildByIdOrDiscordId as jest.Mock).mockResolvedValue({
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
      expect(sharedAnalytics.getActivityChartByGuildId).not.toHaveBeenCalled();
    });
  });
});
