import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SharedAnalyticsService } from '@app/shared';
import { InternalAnalyticsController } from './internal-analytics.controller';
import { InternalApiGuard } from './internal-api.guard';

describe('InternalAnalyticsController', () => {
  let controller: InternalAnalyticsController;
  let sharedAnalytics: jest.Mocked<Pick<SharedAnalyticsService, 'getOverviewByGuildId'>>;

  const guildId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  beforeEach(async () => {
    const mockSharedAnalytics = {
      getOverviewByGuildId: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalAnalyticsController],
      providers: [
        { provide: SharedAnalyticsService, useValue: mockSharedAnalytics },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(InternalApiGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(InternalAnalyticsController);
    sharedAnalytics = module.get(SharedAnalyticsService);
  });

  it('getOverview returns data from SharedAnalyticsService', async () => {
    (sharedAnalytics.getOverviewByGuildId as jest.Mock).mockResolvedValue({
      totalMessages: 100,
      activeMembers24h: 5,
      activeMembers7d: 12,
    });

    const result = await controller.getOverview(guildId);

    expect(sharedAnalytics.getOverviewByGuildId).toHaveBeenCalledWith(guildId);
    expect(result).toEqual({
      totalMessages: 100,
      activeMembers24h: 5,
      activeMembers7d: 12,
    });
  });
});
