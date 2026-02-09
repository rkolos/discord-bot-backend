import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Guild, User, SubscriptionPlan, SharedAnalyticsService } from '@app/shared';
import { PublicService } from './public.service';

describe('PublicService', () => {
  let service: PublicService;
  let sharedAnalytics: jest.Mocked<Pick<SharedAnalyticsService, 'getGlobalTotalMessages'>>;

  beforeEach(async () => {
    const mockGuildRepo = { count: jest.fn().mockResolvedValue(10) };
    const mockUserRepo = { count: jest.fn().mockResolvedValue(100) };
    const mockPlanRepo = { find: jest.fn().mockResolvedValue([]) };
    sharedAnalytics = {
      getGlobalTotalMessages: jest.fn().mockResolvedValue(5000),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicService,
        { provide: getRepositoryToken(Guild), useValue: mockGuildRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(SubscriptionPlan), useValue: mockPlanRepo },
        { provide: SharedAnalyticsService, useValue: sharedAnalytics },
      ],
    }).compile();

    service = module.get(PublicService);
  });

  describe('getPublicStats', () => {
    it('returns totalServers, totalUsers, totalMessages from ClickHouse', async () => {
      const result = await service.getPublicStats();

      expect(result).toEqual({
        totalServers: 10,
        totalUsers: 100,
        totalMessages: 5000,
      });
      expect(sharedAnalytics.getGlobalTotalMessages).toHaveBeenCalledTimes(1);
    });

    it('throws 503 ANALYTICS_UNAVAILABLE when ClickHouse fails', async () => {
      sharedAnalytics.getGlobalTotalMessages.mockRejectedValueOnce(
        new Error('Connection refused'),
      );

      let thrown: unknown;
      try {
        await service.getPublicStats();
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(ServiceUnavailableException);
      const response = (thrown as ServiceUnavailableException).getResponse() as {
        code: string;
        message: string;
      };
      expect(response.code).toBe('ANALYTICS_UNAVAILABLE');
      expect(response.message).toMatch(/Analytics storage.*unavailable.*Connection refused/);
    });
  });
});
