import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { GuildLogSetting } from '@app/shared';
import { GuildsService } from '../guilds/guilds.service';
import { LogsQueueService } from './logs-queue.service';
import { LogsService } from './logs.service';
import { LOG_EVENT_TYPES } from './constants';

describe('LogsService', () => {
  let service: LogsService;
  let logSettingsRepo: jest.Mocked<Repository<GuildLogSetting>>;
  let txRepo: { find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let guildsService: jest.Mocked<Pick<GuildsService, 'findGuildByIdOrDiscordId'>>;
  let queueService: jest.Mocked<Pick<LogsQueueService, 'addLogsConfigUpdate'>>;

  const guildId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const discordGuildId = '111222333444555666';
  const mockGuild = { id: guildId, discordGuildId } as { id: string; discordGuildId: string };

  beforeEach(async () => {
    txRepo = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: { getRepository: jest.fn().mockReturnValue(txRepo) },
    };
    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };
    const mockLogSettingsRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };
    const mockGuildsService = {
      findGuildByIdOrDiscordId: jest.fn(),
    };
    const mockQueueService = {
      addLogsConfigUpdate: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogsService,
        { provide: getRepositoryToken(GuildLogSetting), useValue: mockLogSettingsRepo },
        { provide: DataSource, useValue: mockDataSource },
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
      guildsService.findGuildByIdOrDiscordId!.mockResolvedValue(mockGuild as never);
      (logSettingsRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.getSettings(discordGuildId);

      expect(result).toHaveLength(LOG_EVENT_TYPES.length);
      expect(result.every((r) => r.enabled === false && r.channelId === null)).toBe(true);
      expect(result.map((r) => r.eventType)).toEqual([...LOG_EVENT_TYPES]);
      expect(guildsService.findGuildByIdOrDiscordId).toHaveBeenCalledWith(discordGuildId);
    });

    it('returns stored channelId and enabled for existing rows', async () => {
      guildsService.findGuildByIdOrDiscordId!.mockResolvedValue(mockGuild as never);
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
      guildsService.findGuildByIdOrDiscordId!.mockResolvedValue(null as never);

      const err = await service.getSettings(discordGuildId).catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).getResponse()).toMatchObject({
        code: 'GUILD_NOT_FOUND',
      });
    });
  });

  describe('patchSettings', () => {
    it('creates new rows and calls addLogsConfigUpdate', async () => {
      guildsService.findGuildByIdOrDiscordId!.mockResolvedValue(mockGuild as never);
      txRepo.find.mockResolvedValue([]);
      txRepo.create.mockImplementation((entity: unknown) => entity);
      txRepo.save.mockResolvedValue(undefined);
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
      guildsService.findGuildByIdOrDiscordId!.mockResolvedValue(mockGuild as never);
      const existing = {
        guildId,
        eventType: 'member_join',
        channelId: '111111111111111111',
        enabled: true,
        updatedAt: new Date(),
      };
      txRepo.find.mockResolvedValue([existing]);
      txRepo.create.mockImplementation((entity: unknown) => entity);
      txRepo.save.mockResolvedValue(undefined);
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
      guildsService.findGuildByIdOrDiscordId!.mockResolvedValue(mockGuild as never);
      txRepo.find.mockResolvedValue([]);
      txRepo.create.mockImplementation((entity: unknown) => entity);
      txRepo.save.mockResolvedValue(undefined);
      (logSettingsRepo.find as jest.Mock).mockResolvedValue([]);

      await service.patchSettings(discordGuildId, {
        settings: [
          { eventType: 'member_leave', channelId: '987654321098765432', enabled: true },
          { eventType: 'message_delete', enabled: false },
        ],
      });

      expect(txRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId,
          eventType: 'member_leave',
          channelId: '987654321098765432',
          enabled: true,
        }),
      );
      expect(txRepo.create).toHaveBeenCalledWith(
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
