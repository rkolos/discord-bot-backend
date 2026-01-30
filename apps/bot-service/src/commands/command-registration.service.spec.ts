import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CommandRegistrationService } from './command-registration.service';

const mockFetch = jest.fn();

describe('CommandRegistrationService', () => {
  let service: CommandRegistrationService;

  beforeEach(async () => {
    mockFetch.mockReset();
    global.fetch = mockFetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommandRegistrationService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => (key === 'DISCORD_BOT_TOKEN' ? undefined : undefined)) },
        },
      ],
    }).compile();

    service = module.get(CommandRegistrationService);
  });

  describe('registerGlobalCommands', () => {
    it('calls GET applications/@me then PUT applications/:id/commands', async () => {
      const token = 'test-token';
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'app-123' }),
        })
        .mockResolvedValueOnce({ ok: true });

      await service.registerGlobalCommands(token);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://discord.com/api/v10/applications/@me',
        expect.objectContaining({
          method: 'GET',
          headers: { Authorization: 'Bot test-token', 'Content-Type': 'application/json' },
        }),
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://discord.com/api/v10/applications/app-123/commands',
        expect.objectContaining({
          method: 'PUT',
          headers: { Authorization: 'Bot test-token', 'Content-Type': 'application/json' },
        }),
      );
      const putBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(Array.isArray(putBody)).toBe(true);
      expect(putBody.some((c: { name: string }) => c.name === 'ping')).toBe(true);
      expect(putBody.some((c: { name: string }) => c.name === 'stats')).toBe(true);
    });
  });

  describe('registerGuildCommands', () => {
    it('calls GET applications/@me then PUT applications/:id/guilds/:guildId/commands', async () => {
      const token = 'test-token';
      const discordGuildId = '123456789';
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'app-456' }),
        })
        .mockResolvedValueOnce({ ok: true });

      await service.registerGuildCommands(token, discordGuildId);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        `https://discord.com/api/v10/applications/app-456/guilds/${discordGuildId}/commands`,
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });
});
