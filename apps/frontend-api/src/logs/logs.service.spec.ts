import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuildLogSetting } from '@app/shared';
import { GuildsService } from '../guilds/guilds.service';
import { LogsQueueService } from './logs-queue.service';
import { LogsService } from './logs.service';
import { LOG_EVENT_TYPES } from './constants';

describe('LogsService', () => {
  let service: LogsService;
  let logSettingsRepo: jest.Mocked<Repository<GuildLogSetting>>;
  let guildsService: jest.Mocked<Pick<GuildsService, 'findGuildByDiscordId'>>;
  let queueService: jest.Mocked<Pick<LogsQueueService, 'addLogsConfigUpdate'>>;

  const guildId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const discordGuildId = '111222333444555666';
  const mockGuild = { id: guildId, discordGuildId } as { id: string; discordGuildId: string };

  beforeEach(async () => {
    const mockLogSettingsRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    const mockGuildsService = {
      findGuildByDiscordId: jest.fn(),
    };
    const mockQueueService = {
      addLogsConfigUpdate: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogsService,
        { provide: getRepositoryToken(GuildLogSetting), useValue: mockLogSettingsRepo },
        { provide: GuildsService, useValue: mockGuildsService },
        { provide: LogsQueueService, useValue: mockQueueService },
      ],
    }).compile();

    service = module.get(LogsService);
    logSettingsRepo = module.get(getRepositoryToken(GuildLogSetting));
    guildsService = module.get(GuildsService);
    queueService = module.get(LogsQueueService);
  });

  describe('getSettings', () => {
    it('returns all event types with defaults when no rows exist', async () => {
      guildsService.findGuildByDiscordId!.mockResolvedValue(mockGuild as never);
      (logSettingsRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.getSettings(discordGuildId);

      expect(result).toHaveLength(LOG_EVENT_TYPES.length);
      expect(result.every((r) => r.enabled === false && r.channelId === null)).toBe(true);
      expect(result.map((r) => r.eventType)).toEqual([...LOG_EVENT_TYPES]);
      expect(guildsService.findGuildByDiscordId).toHaveBeenCalledWith(discordGuildId);
    });

    it('returns stored channelId and enabled for existing rows', async () => {
      guildsService.findGuildByDiscordId!.mockResolvedValue(mockGuild as never);
      (logSettingsRepo.find as jest.Mock).mockResolvedValue([
        { guildId, eventType: 'member_join', channelId: '987654321098765432', enabled: true },
      ]);

      const result = await service.getSettings(discordGuildId);

      const memberJoin = result.find((r) => r.eventType === 'member_join');
      expect(memberJoin).toEqual({
        eventType: 'member_join',
        channelId: '987654321098765432',
        enabled: true,
      });
    });

    it('throws GUILD_NOT_FOUND when guild does not exist', async () => {
      guildsService.findGuildByDiscordId!.mockResolvedValue(null as never);

      const err = await service.getSettings(discordGuildId).catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).getResponse()).toMatchObject({
        code: 'GUILD_NOT_FOUND',
      });
    });
  });

  describe('patchSettings', () => {
    it('creates new rows and calls addLogsConfigUpdate', async () => {
      guildsService.findGuildByDiscordId!.mockResolvedValue(mockGuild as never);
      (logSettingsRepo.findOne as jest.Mock).mockResolvedValue(null);
      const created = {
        guildId,
        eventType: 'member_join',
        channelId: '987654321098765432',
        enabled: true,
        updatedAt: new Date(),
      };
      (logSettingsRepo.create as jest.Mock).mockReturnValue(created);
      (logSettingsRepo.save as jest.Mock).mockResolvedValue(created);
      (logSettingsRepo.find as jest.Mock).mockResolvedValue([]);

      await service.patchSettings(discordGuildId, {
        settings: [
          { eventType: 'member_join', channelId: '987654321098765432', enabled: true },
        ],
      });

      expect(queueService.addLogsConfigUpdate).toHaveBeenCalledWith({
        guild_id: guildId,
        discord_guild_id: discordGuildId,
      });
    });

    it('updates existing row and calls addLogsConfigUpdate when channel_id or enabled changed', async () => {
      guildsService.findGuildByDiscordId!.mockResolvedValue(mockGuild as never);
      const existing = {
        guildId,
        eventType: 'member_join',
        channelId: '111111111111111111',
        enabled: true,
        updatedAt: new Date(),
      };
      (logSettingsRepo.findOne as jest.Mock).mockResolvedValue(existing);
      (logSettingsRepo.save as jest.Mock).mockResolvedValue({ ...existing, channelId: '987654321098765432' });
      (logSettingsRepo.find as jest.Mock).mockResolvedValue([]);

      await service.patchSettings(discordGuildId, {
        settings: [
          { eventType: 'member_join', channelId: '987654321098765432', enabled: true },
        ],
      });

      expect(queueService.addLogsConfigUpdate).toHaveBeenCalledWith({
        guild_id: guildId,
        discord_guild_id: discordGuildId,
      });
    });

    it('maps event types correctly when patching multiple settings', async () => {
      guildsService.findGuildByDiscordId!.mockResolvedValue(mockGuild as never);
      (logSettingsRepo.findOne as jest.Mock).mockResolvedValue(null);
      (logSettingsRepo.create as jest.Mock).mockImplementation((entity) => entity);
      (logSettingsRepo.save as jest.Mock).mockResolvedValue(undefined);
      (logSettingsRepo.find as jest.Mock).mockResolvedValue([]);

      await service.patchSettings(discordGuildId, {
        settings: [
          { eventType: 'member_leave', channelId: '987654321098765432', enabled: true },
          { eventType: 'message_delete', enabled: false },
        ],
      });

      expect(logSettingsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId,
          eventType: 'member_leave',
          channelId: '987654321098765432',
          enabled: true,
        }),
      );
      expect(logSettingsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId,
          eventType: 'message_delete',
          channelId: null,
          enabled: false,
        }),
      );
    });
  });

  describe('getEvents', () => {
    it('returns list of event types with id, name, description', () => {
      const result = service.getEvents();

      expect(result).toHaveLength(LOG_EVENT_TYPES.length);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('description');
      expect(result.find((e) => e.id === 'member_join')).toBeDefined();
    });
  });
});
