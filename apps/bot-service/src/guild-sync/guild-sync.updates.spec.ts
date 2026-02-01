import type { EntityManager } from 'typeorm';
import { Guild, GuildStatus, ServerSettings } from '@app/shared';
import {
  syncOnReady,
  syncOnGuildCreate,
  syncOnGuildDelete,
} from './guild-sync.updates';

describe('guild-sync.updates', () => {
  let manager: jest.Mocked<Pick<EntityManager, 'findOne' | 'save'>>;

  beforeEach(() => {
    manager = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((entity, obj) => Promise.resolve(obj ?? entity)),
    };
  });

  describe('syncOnReady', () => {
    it('does nothing when isCustomToken is false', async () => {
      await syncOnReady(manager as unknown as EntityManager, {
        discordGuildId: '123',
        botUserId: '456',
        shardId: 0,
        isCustomToken: false,
      });
      expect(manager.findOne).not.toHaveBeenCalled();
    });

    it('does nothing when guildIdUuid is missing for custom token', async () => {
      await syncOnReady(manager as unknown as EntityManager, {
        discordGuildId: '123',
        botUserId: '456',
        shardId: 0,
        isCustomToken: true,
      });
      expect(manager.findOne).not.toHaveBeenCalled();
    });

    it('updates server_settings when isCustomToken and guildIdUuid set', async () => {
      const settings = {
        guildId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        botConnected: false,
        botUserId: null as string | null,
        lastConnected: null as Date | null,
      };
      (manager.findOne as jest.Mock).mockResolvedValue(settings);

      await syncOnReady(manager as unknown as EntityManager, {
        discordGuildId: '123',
        botUserId: '789',
        shardId: 0,
        guildIdUuid: settings.guildId,
        isCustomToken: true,
      });

      expect(manager.findOne).toHaveBeenCalledWith(ServerSettings, {
        where: { guildId: settings.guildId },
      });
      expect(settings.botConnected).toBe(true);
      expect(settings.botUserId).toBe('789');
      expect(settings.lastConnected).toBeInstanceOf(Date);
      expect(manager.save).toHaveBeenCalledWith(ServerSettings, settings);
    });
  });

  describe('syncOnGuildCreate', () => {
    it('returns FirstContactPayload when guild not in DB and discordOwnerId provided', async () => {
      (manager.findOne as jest.Mock).mockResolvedValue(null);

      const result = await syncOnGuildCreate(manager as unknown as EntityManager, {
        discordGuildId: '123',
        guildName: 'Test',
        shardId: 0,
        discordOwnerId: '999',
      });

      expect(manager.findOne).toHaveBeenCalledWith(Guild, {
        where: { discordGuildId: '123' },
      });
      expect(manager.save).not.toHaveBeenCalled();
      expect(result).toEqual({ discordGuildId: '123', guildName: 'Test', discordOwnerId: '999' });
    });

    it('returns null when guild not in DB and discordOwnerId not provided', async () => {
      (manager.findOne as jest.Mock).mockResolvedValue(null);

      const result = await syncOnGuildCreate(manager as unknown as EntityManager, {
        discordGuildId: '123',
        guildName: 'Test',
        shardId: 0,
      });

      expect(result).toBeNull();
    });

    it('updates guild and server_settings when guild exists', async () => {
      const guild = {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        discordGuildId: '123',
        isBotInGuild: false,
        shardId: null as number | null,
      };
      const settings = {
        guildId: guild.id,
        botConnected: false,
        lastConnected: null as Date | null,
      };
      (manager.findOne as jest.Mock)
        .mockResolvedValueOnce(guild)
        .mockResolvedValueOnce(settings);

      const result = await syncOnGuildCreate(manager as unknown as EntityManager, {
        discordGuildId: '123',
        guildName: 'Test',
        shardId: 1,
      });

      expect(result).toEqual({ syncedGuildId: guild.id });
      expect(guild.isBotInGuild).toBe(true);
      expect(guild.shardId).toBe(1);
      expect(settings.botConnected).toBe(true);
      expect(settings.lastConnected).toBeInstanceOf(Date);
      expect(manager.save).toHaveBeenCalledWith(Guild, guild);
      expect(manager.save).toHaveBeenCalledWith(ServerSettings, settings);
    });
  });

  describe('syncOnGuildDelete', () => {
    it('does nothing when guild not in DB', async () => {
      (manager.findOne as jest.Mock).mockResolvedValue(null);

      await syncOnGuildDelete(manager as unknown as EntityManager, {
        discordGuildId: '123',
      });

      expect(manager.save).not.toHaveBeenCalled();
    });

    it('sets status inactive and is_bot_in_guild false when guild exists', async () => {
      const guild = {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        discordGuildId: '123',
        status: GuildStatus.ACTIVE,
        isBotInGuild: true,
      };
      (manager.findOne as jest.Mock).mockResolvedValue(guild);

      await syncOnGuildDelete(manager as unknown as EntityManager, {
        discordGuildId: '123',
      });

      expect(guild.status).toBe(GuildStatus.INACTIVE);
      expect(guild.isBotInGuild).toBe(false);
      expect(manager.save).toHaveBeenCalledWith(Guild, guild);
    });
  });
});
