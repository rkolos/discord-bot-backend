import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { getEntityManagerToken } from '@nestjs/typeorm';
import { of } from 'rxjs';
import type { EntityManager } from 'typeorm';
import { Guild, ServerSettings } from '@app/shared';
import { GuildReconciliationService } from './guild-reconciliation.service';
import { GuildSyncService } from './guild-sync.service';
import { MultiTokenConnectionManagerService } from '../multi-token/multi-token-connection-manager.service';

describe('GuildReconciliationService', () => {
  let service: GuildReconciliationService;
  let guildSync: Pick<GuildSyncService, 'onGuildDelete' | 'onGuildCreate'>;
  let configService: Pick<ConfigService, 'get'>;
  let httpService: Pick<HttpService, 'get'>;
  let multiToken: Pick<
    MultiTokenConnectionManagerService,
    'getCustomGuildIds' | 'isGuildInCache'
  >;
  let manager: EntityManager & {
    serverSettingsFind: jest.Mock;
    guildFind: jest.Mock;
    guildFindOne: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    const serverSettingsRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    const guildRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    const managerFindOne = jest.fn().mockResolvedValue(null);
    manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === ServerSettings) {
          return serverSettingsRepo;
        }
        if (entity === Guild) {
          return guildRepo;
        }
        return {};
      }) as unknown as EntityManager['getRepository'],
      findOne: managerFindOne,
      serverSettingsFind: serverSettingsRepo.find as jest.Mock,
      guildFind: guildRepo.find as jest.Mock,
      guildFindOne: guildRepo.findOne as jest.Mock,
    } as unknown as EntityManager & {
      serverSettingsFind: jest.Mock;
      guildFind: jest.Mock;
      guildFindOne: jest.Mock;
      findOne: jest.Mock;
    };

    guildSync = {
      onGuildDelete: jest.fn().mockResolvedValue(undefined),
      onGuildCreate: jest.fn().mockResolvedValue(undefined),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'GUILD_RECONCILIATION_ENABLED') return undefined;
        if (key === 'DISCORD_BOT_TOKEN') return 'test-bot-token';
        return undefined;
      }) as ConfigService['get'],
    };
    httpService = {
      get: jest.fn().mockReturnValue(
        of({
          status: 200,
          data: [{ id: 'discord-guild-1', name: 'G1', icon: null }],
          headers: {},
        }),
      ),
    };
    multiToken = {
      getCustomGuildIds: jest.fn().mockReturnValue(new Map<string, string>()),
      isGuildInCache: jest.fn().mockReturnValue(false),
    } as unknown as Pick<
      MultiTokenConnectionManagerService,
      'getCustomGuildIds' | 'isGuildInCache'
    >;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuildReconciliationService,
        { provide: getEntityManagerToken(), useValue: manager },
        { provide: GuildSyncService, useValue: guildSync },
        { provide: ConfigService, useValue: configService },
        { provide: HttpService, useValue: httpService },
        { provide: MultiTokenConnectionManagerService, useValue: multiToken },
      ],
    }).compile();

    service = module.get(GuildReconciliationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reconcile', () => {
    it('does nothing when GUILD_RECONCILIATION_ENABLED is false', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'GUILD_RECONCILIATION_ENABLED') return 'false';
        if (key === 'DISCORD_BOT_TOKEN') return 'token';
        return undefined;
      });
      await service.reconcile();
      expect(httpService.get).not.toHaveBeenCalled();
      expect(guildSync.onGuildDelete).not.toHaveBeenCalled();
      expect(guildSync.onGuildCreate).not.toHaveBeenCalled();
    });

    it('calls onGuildDelete when main-bot guild in DB is not in API list', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DISCORD_BOT_TOKEN') return 'token';
        return undefined;
      });
      manager.guildFind.mockResolvedValue([
        {
          id: 'uuid-left',
          discordGuildId: 'discord-left',
          name: 'Left Guild',
        },
      ]);
      manager.serverSettingsFind.mockResolvedValue([]);
      manager.guildFindOne.mockResolvedValue(null);

      await service.reconcile();

      expect(guildSync.onGuildDelete).toHaveBeenCalledWith({
        discordGuildId: 'discord-left',
      });
    });

    it('calls onGuildCreate when API guild is in DB with isBotInGuild false', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DISCORD_BOT_TOKEN') return 'token';
        return undefined;
      });
      manager.serverSettingsFind.mockResolvedValue([]);
      manager.guildFind.mockResolvedValue([]);
      manager.findOne.mockResolvedValue({
        id: 'uuid-1',
        discordGuildId: 'discord-guild-1',
        name: 'G1',
        isBotInGuild: false,
      });

      await service.reconcile();

      expect(guildSync.onGuildCreate).toHaveBeenCalledWith({
        discordGuildId: 'discord-guild-1',
        guildName: 'G1',
        shardId: 0,
      });
    });

    it('does not call onGuildDelete for main-bot guild when it is in API list', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DISCORD_BOT_TOKEN') return 'token';
        return undefined;
      });
      manager.serverSettingsFind.mockResolvedValue([]);
      manager.guildFind.mockResolvedValue([
        {
          id: 'uuid-1',
          discordGuildId: 'discord-guild-1',
          name: 'G1',
        },
      ]);
      manager.guildFindOne.mockResolvedValue(null);

      await service.reconcile();

      expect(guildSync.onGuildDelete).not.toHaveBeenCalled();
    });

    it('calls onGuildDelete for custom token guild when not in cache', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DISCORD_BOT_TOKEN') return 'token';
        return undefined;
      });
      manager.serverSettingsFind.mockResolvedValue([]);
      manager.guildFind.mockResolvedValue([]);
      (multiToken.getCustomGuildIds as jest.Mock).mockReturnValue(
        new Map([['custom-uuid-1', 'custom-discord-1']]),
      );
      (multiToken.isGuildInCache as jest.Mock).mockReturnValue(false);
      manager.findOne.mockResolvedValue({
        id: 'custom-uuid-1',
        discordGuildId: 'custom-discord-1',
        name: 'Custom',
        isBotInGuild: true,
      });

      await service.reconcile();

      expect(guildSync.onGuildDelete).toHaveBeenCalledWith({
        discordGuildId: 'custom-discord-1',
      });
    });

    it('calls onGuildCreate for custom token guild when in cache and isBotInGuild false', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DISCORD_BOT_TOKEN') return 'token';
        return undefined;
      });
      manager.serverSettingsFind.mockResolvedValue([]);
      manager.guildFind.mockResolvedValue([]);
      (multiToken.getCustomGuildIds as jest.Mock).mockReturnValue(
        new Map([['custom-uuid-1', 'custom-discord-1']]),
      );
      (multiToken.isGuildInCache as jest.Mock).mockReturnValue(true);
      manager.findOne.mockResolvedValue({
        id: 'custom-uuid-1',
        discordGuildId: 'custom-discord-1',
        name: 'Custom',
        isBotInGuild: false,
      });

      await service.reconcile();

      expect(guildSync.onGuildCreate).toHaveBeenCalledWith({
        discordGuildId: 'custom-discord-1',
        guildName: 'Custom',
        shardId: 0,
      });
    });

    it('skips main bot reconciliation when DISCORD_BOT_TOKEN is not set', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'GUILD_RECONCILIATION_ENABLED') return undefined;
        if (key === 'DISCORD_BOT_TOKEN') return undefined;
        return undefined;
      });
      await service.reconcile();
      expect(httpService.get).not.toHaveBeenCalled();
    });
  });
});
