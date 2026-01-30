import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CryptoService, SharedConfigService } from '@app/shared';
import { Guild, ServerSettings } from '@app/shared';
import { MultiTokenConnectionManagerService } from './multi-token-connection-manager.service';
import { MultiTokenEventsService } from './multi-token-events.service';
import { GuildSyncService } from '../guild-sync/guild-sync.service';
import { CommandRegistrationService } from '../commands/command-registration.service';

const mockLogin = jest.fn().mockResolvedValue(undefined);
jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    login: mockLogin,
    on: jest.fn(),
    once: jest.fn(),
    destroy: jest.fn().mockResolvedValue(undefined),
  })),
  GatewayIntentBits: { Guilds: 1, GuildMembers: 2, GuildMessages: 512, GuildVoiceStates: 256 },
}));

describe('MultiTokenConnectionManagerService', () => {
  let service: MultiTokenConnectionManagerService;
  let cryptoDecrypt: jest.Mock;
  let serverSettingsRepo: jest.Mocked<Pick<Repository<ServerSettings>, 'find'>>;

  const guildIdUuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const encryptedToken = 'v1:iv:tag:cipher';
  const plainToken = 'plain-bot-token';

  const mockSharedConfig = {
    redis: { host: 'localhost', port: 6379, password: undefined, prefix: 'sn:test:' },
  };
  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'PORT' || key === 'HEALTH_PORT') return 3003;
      if (key === 'BOT_SERVICE_INTERNAL_BASE_URL') return undefined;
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    cryptoDecrypt = jest.fn().mockReturnValue(plainToken);
    const mockFind = jest.fn().mockResolvedValue([]);
    serverSettingsRepo = { find: mockFind };
    const mockGuildRepo = { findOne: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MultiTokenConnectionManagerService,
        { provide: CryptoService, useValue: { decrypt: cryptoDecrypt } },
        { provide: getRepositoryToken(ServerSettings), useValue: serverSettingsRepo },
        { provide: getRepositoryToken(Guild), useValue: mockGuildRepo },
        {
          provide: GuildSyncService,
          useValue: { onReady: jest.fn(), onGuildCreate: jest.fn(), onGuildDelete: jest.fn() },
        },
        { provide: SharedConfigService, useValue: mockSharedConfig },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: CommandRegistrationService,
          useValue: { registerForToken: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: MultiTokenEventsService,
          useValue: {
            onGuildMemberAdd: jest.fn().mockResolvedValue(undefined),
            onGuildMemberRemove: jest.fn().mockResolvedValue(undefined),
            onMessageDelete: jest.fn().mockResolvedValue(undefined),
            onMessageUpdate: jest.fn().mockResolvedValue(undefined),
            onVoiceStateUpdate: jest.fn().mockResolvedValue(undefined),
            onGuildMemberUpdate: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(MultiTokenConnectionManagerService);
  });

  describe('token choice', () => {
    it('hasCustomTokenForGuild returns false when no custom clients', () => {
      expect(service.hasCustomTokenForGuild(guildIdUuid)).toBe(false);
    });

    it('getTokenKindForGuild returns main when no custom token for guild', () => {
      expect(service.getTokenKindForGuild(guildIdUuid)).toBe('main');
    });
  });

  describe('decrypt before client', () => {
    it('calls CryptoService.decrypt with encrypted value and passes result to client.login', async () => {
      (serverSettingsRepo.find as jest.Mock).mockResolvedValue([
        {
          guildId: guildIdUuid,
          botTokenEncrypted: encryptedToken,
          guild: { discordGuildId: '123' },
        },
      ]);

      await service.onModuleInit();

      expect(cryptoDecrypt).toHaveBeenCalledWith(encryptedToken);
      expect(mockLogin).toHaveBeenCalledWith(plainToken);
    });

    it('does not create client when decrypt throws', async () => {
      cryptoDecrypt.mockImplementation(() => {
        throw new Error('decrypt failed');
      });
      (serverSettingsRepo.find as jest.Mock).mockResolvedValue([
        {
          guildId: guildIdUuid,
          botTokenEncrypted: encryptedToken,
          guild: { discordGuildId: '123' },
        },
      ]);

      await service.onModuleInit();

      expect(service.hasCustomTokenForGuild(guildIdUuid)).toBe(false);
    });
  });
});
