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

  describe('getUserStatsForExport', () => {
    it('returns zeros when both userId and discordId are empty', async () => {
      const result = await service.getUserStatsForExport('', null);
      expect(result).toEqual({ totalMessages: 0, totalVoiceMinutes: 0 });
      expect(clickhouse.query).not.toHaveBeenCalled();
    });

    it('returns stats from ClickHouse when both userId and discordId provided', async () => {
      (clickhouse.query as jest.Mock).mockResolvedValue({
        json: async () => [{ totalMessages: 100, totalVoiceMinutes: 45 }],
      });

      const result = await service.getUserStatsForExport(
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        '123456789012345678',
      );

      expect(result).toEqual({ totalMessages: 100, totalVoiceMinutes: 45 });
      expect(clickhouse.query).toHaveBeenCalledWith(
        expect.objectContaining({
          query_params: expect.objectContaining({
            userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            discordId: '123456789012345678',
          }),
        }),
      );
    });

    it('returns stats when only userId provided', async () => {
      (clickhouse.query as jest.Mock).mockResolvedValue({
        json: async () => [{ totalMessages: 50, totalVoiceMinutes: 20 }],
      });

      const result = await service.getUserStatsForExport(
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        null,
      );

      expect(result).toEqual({ totalMessages: 50, totalVoiceMinutes: 20 });
    });

    it('returns zeros when ClickHouse returns empty rows', async () => {
      (clickhouse.query as jest.Mock).mockResolvedValue({
        json: async () => [],
      });

      const result = await service.getUserStatsForExport(
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        '123456789012345678',
      );

      expect(result).toEqual({ totalMessages: 0, totalVoiceMinutes: 0 });
    });
  });
});
