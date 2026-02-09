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
    it('returns array with zero values for every date in period when ClickHouse returns no rows', async () => {
      (clickhouse.query as jest.Mock).mockResolvedValue({
        json: async () => [],
      });

      const result = await service.getActivityChartByGuildId(
        guildId,
        '2025-01-01',
        '2025-01-31',
      );

      expect(result).toHaveLength(31);
      expect(result[0]).toEqual({
        date: '2025-01-01',
        messages: 0,
        members: 0,
        voiceMinutes: 0,
      });
      expect(result.every((p) => p.messages === 0 && p.members === 0 && p.voiceMinutes === 0)).toBe(true);
    });
  });

  describe('getTopMembersByGuildId', () => {
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

    it('returns Anonymous when anonymizeUserData is true (default)', async () => {
      (clickhouse.query as jest.Mock).mockResolvedValue({
        json: async () => [
          {
            id: '123456789',
            username_from_payload: 'SomeUser#1234',
            avatar_hash: 'abc123',
            messages: 100,
            voice_minutes: 50,
          },
        ],
      });

      const result = await service.getTopMembersByGuildId(
        guildId,
        'messages',
        10,
      );

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('Anonymous');
      expect(result[0].avatar).toBe('');
      expect(result[0].messages).toBe(100);
      expect(result[0].voiceMinutes).toBe(50);
    });

    it('returns username from payload when anonymizeUserData is false', async () => {
      (clickhouse.query as jest.Mock).mockResolvedValue({
        json: async () => [
          {
            id: '987654321',
            username_from_payload: 'CoolUser#5678',
            avatar_hash: 'def456',
            messages: 200,
            voice_minutes: 100,
          },
        ],
      });

      const result = await service.getTopMembersByGuildId(
        guildId,
        'messages',
        10,
        { anonymizeUserData: false },
      );

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('CoolUser#5678');
      expect(result[0].id).toBe('987654321');
      expect(result[0].avatar).toBe(
        'https://cdn.discordapp.com/avatars/987654321/def456.png?size=80',
      );
    });
  });

  describe('getTotalMessagesByGuildId', () => {
    it('returns total messages from ClickHouse for one guild', async () => {
      (clickhouse.query as jest.Mock).mockResolvedValue({
        json: async () => [{ total: 1500 }],
      });

      const result = await service.getTotalMessagesByGuildId(guildId);

      expect(result).toBe(1500);
      expect(clickhouse.query).toHaveBeenCalledWith(
        expect.objectContaining({
          query_params: { guildId },
        }),
      );
    });

    it('returns 0 when ClickHouse returns no rows', async () => {
      (clickhouse.query as jest.Mock).mockResolvedValue({
        json: async () => [],
      });

      const result = await service.getTotalMessagesByGuildId(guildId);

      expect(result).toBe(0);
    });

    it('rethrows when ClickHouse query throws', async () => {
      (clickhouse.query as jest.Mock).mockRejectedValue(new Error('Connection refused'));

      await expect(service.getTotalMessagesByGuildId(guildId)).rejects.toThrow('Connection refused');
    });
  });

  describe('getGlobalTotalMessages', () => {
    it('returns global total messages from ClickHouse', async () => {
      (clickhouse.query as jest.Mock).mockResolvedValue({
        json: async () => [{ total: 50000 }],
      });

      const result = await service.getGlobalTotalMessages();

      expect(result).toBe(50000);
      expect(clickhouse.query).toHaveBeenCalledWith(
        expect.objectContaining({
          query_params: {},
        }),
      );
    });

    it('returns 0 when ClickHouse returns no rows', async () => {
      (clickhouse.query as jest.Mock).mockResolvedValue({
        json: async () => [],
      });

      const result = await service.getGlobalTotalMessages();

      expect(result).toBe(0);
    });

    it('rethrows when ClickHouse query throws', async () => {
      (clickhouse.query as jest.Mock).mockRejectedValue(new Error('Timeout'));

      await expect(service.getGlobalTotalMessages()).rejects.toThrow('Timeout');
    });
  });

  describe('getTotalMessagesByGuildIds', () => {
    it('returns Map of guild_id to total messages', async () => {
      (clickhouse.query as jest.Mock).mockResolvedValue({
        json: async () => [
          { guild_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', total: 100 },
          { guild_id: 'b1ffcd00-0c1c-4fa9-ac7e-7ca0ce491b22', total: 200 },
        ],
      });

      const result = await service.getTotalMessagesByGuildIds([
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        'b1ffcd00-0c1c-4fa9-ac7e-7ca0ce491b22',
      ]);

      expect(result.size).toBe(2);
      expect(result.get('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')).toBe(100);
      expect(result.get('b1ffcd00-0c1c-4fa9-ac7e-7ca0ce491b22')).toBe(200);
      expect(clickhouse.query).toHaveBeenCalledWith(
        expect.objectContaining({
          query_params: {
            guildIds: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1ffcd00-0c1c-4fa9-ac7e-7ca0ce491b22'],
          },
        }),
      );
    });

    it('returns empty Map when guildIds is empty', async () => {
      const result = await service.getTotalMessagesByGuildIds([]);

      expect(result.size).toBe(0);
      expect(clickhouse.query).not.toHaveBeenCalled();
    });

    it('returns empty Map when ClickHouse returns no rows', async () => {
      (clickhouse.query as jest.Mock).mockResolvedValue({
        json: async () => [],
      });

      const result = await service.getTotalMessagesByGuildIds([guildId]);

      expect(result.size).toBe(0);
    });

    it('rethrows when ClickHouse query throws', async () => {
      (clickhouse.query as jest.Mock).mockRejectedValue(new Error('Connection refused'));

      await expect(
        service.getTotalMessagesByGuildIds(['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11']),
      ).rejects.toThrow('Connection refused');
    });
  });

  describe('getHeatmapByGuildId', () => {
    it('returns 168 cells with values from ClickHouse mv_heatmap', async () => {
      (clickhouse.query as jest.Mock).mockResolvedValue({
        json: async () => [
          { day_of_week: 1, hour: 14, value: 50 },
          { day_of_week: 0, hour: 20, value: 30 },
        ],
      });

      const result = await service.getHeatmapByGuildId(guildId);

      expect(result).toHaveLength(168);
      expect(result.filter((c) => c.dayOfWeek === 1 && c.hour === 14)).toEqual([
        { dayOfWeek: 1, hour: 14, value: 50 },
      ]);
      expect(result.filter((c) => c.dayOfWeek === 0 && c.hour === 20)).toEqual([
        { dayOfWeek: 0, hour: 20, value: 30 },
      ]);
      expect(result.filter((c) => c.dayOfWeek === 0 && c.hour === 0)[0].value).toBe(0);
    });

    it('returns all cells with value 0 when ClickHouse returns empty', async () => {
      (clickhouse.query as jest.Mock).mockResolvedValue({
        json: async () => [],
      });

      const result = await service.getHeatmapByGuildId(guildId);

      expect(result).toHaveLength(168);
      expect(result.every((c) => c.value === 0)).toBe(true);
      expect(result[0]).toEqual({ dayOfWeek: 0, hour: 0, value: 0 });
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
