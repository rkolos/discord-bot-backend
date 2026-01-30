import { Test, TestingModule } from '@nestjs/testing';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { SharedConfigService } from '../config/shared-config.service';
import { SharedAnalyticsService } from './shared-analytics.service';

describe('SharedAnalyticsService', () => {
  let service: SharedAnalyticsService;
  let clickhouse: jest.Mocked<Pick<ClickHouseService, 'query'>>;

  const guildId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  beforeEach(async () => {
    const mockQuery = jest.fn();
    const mockClickhouse = { query: mockQuery };
    const mockSharedConfig = { clickhouse: { database: 'default' } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharedAnalyticsService,
        { provide: ClickHouseService, useValue: mockClickhouse },
        { provide: SharedConfigService, useValue: mockSharedConfig },
      ],
    }).compile();

    service = module.get(SharedAnalyticsService);
    clickhouse = module.get(ClickHouseService);
  });

  describe('getOverviewByGuildId with empty data', () => {
    it('returns zeros when ClickHouse returns empty or null rows', async () => {
      (clickhouse.query as jest.Mock)
        .mockResolvedValueOnce({ json: async () => [{ today: '2025-01-15' }] })
        .mockResolvedValueOnce({ json: async () => [] })
        .mockResolvedValueOnce({ json: async () => [] })
        .mockResolvedValueOnce({ json: async () => [] });

      const result = await service.getOverviewByGuildId(guildId);

      expect(result).toEqual({
        totalMessages: 0,
        activeMembers24h: 0,
        activeMembers7d: 0,
      });
    });
  });

  describe('getActivityChartByGuildId with empty data', () => {
    it('returns empty array when ClickHouse returns no rows', async () => {
      (clickhouse.query as jest.Mock).mockResolvedValue({
        json: async () => [],
      });

      const result = await service.getActivityChartByGuildId(
        guildId,
        '2025-01-01',
        '2025-01-31',
      );

      expect(result).toEqual([]);
    });
  });

  describe('getTopMembersByGuildId with empty data', () => {
    it('returns empty array when ClickHouse returns no rows', async () => {
      (clickhouse.query as jest.Mock).mockResolvedValue({
        json: async () => [],
      });

      const result = await service.getTopMembersByGuildId(
        guildId,
        'messages',
        10,
      );

      expect(result).toEqual([]);
    });
  });
});
