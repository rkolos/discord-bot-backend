import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { SharedConfigService } from '@app/shared';
import type { GuildStateEventPayload } from '@app/shared';
import { GuildsService } from '../guilds/guilds.service';
import { GuildStateGateway } from './guild-state.gateway';

describe('GuildStateGateway', () => {
  let gateway: GuildStateGateway;
  let guildsService: jest.Mocked<Pick<GuildsService, 'findGuildByIdOrDiscordId' | 'userHasGuildAdmin'>>;

  beforeEach(async () => {
    guildsService = {
      findGuildByIdOrDiscordId: jest.fn(),
      userHasGuildAdmin: jest.fn().mockResolvedValue(false),
    };
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      providers: [
        GuildStateGateway,
        { provide: SharedConfigService, useValue: { auth: { jwtSecret: 'test-secret' } } },
        { provide: GuildsService, useValue: guildsService },
      ],
    }).compile();
    gateway = module.get(GuildStateGateway);
    gateway.server = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as unknown as GuildStateGateway['server'];
  });

  describe('handleSubscribe', () => {
    it('joins room only when guild exists and user is owner', async () => {
      const client = {
        userId: 'user-1',
        join: jest.fn().mockResolvedValue(undefined),
      } as unknown as Parameters<GuildStateGateway['handleSubscribe']>[0];
      (guildsService.findGuildByIdOrDiscordId as jest.Mock)
        .mockResolvedValueOnce({ id: 'guild-uuid-1', ownerId: 'user-1' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'guild-uuid-2', ownerId: 'other-user', discordGuildId: 'discord-3' });
      await gateway.handleSubscribe(client, { guildIds: ['discord-1', 'discord-2', 'discord-3'] });
      expect(client.join).toHaveBeenCalledTimes(1);
      expect(client.join).toHaveBeenCalledWith('guild:guild-uuid-1');
    });

    it('does nothing when payload has no guildIds', async () => {
      const client = { userId: 'user-1', join: jest.fn() } as unknown as Parameters<GuildStateGateway['handleSubscribe']>[0];
      await gateway.handleSubscribe(client, {});
      await gateway.handleSubscribe(client, { guildIds: undefined });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('does nothing when client has no userId', async () => {
      const client = { join: jest.fn() } as unknown as Parameters<GuildStateGateway['handleSubscribe']>[0];
      await gateway.handleSubscribe(client, { guildIds: ['discord-1'] });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('allows guild admin (not owner) to join when userHasGuildAdmin returns true', async () => {
      const client = {
        userId: 'user-1',
        join: jest.fn().mockResolvedValue(undefined),
      } as unknown as Parameters<GuildStateGateway['handleSubscribe']>[0];
      (guildsService.findGuildByIdOrDiscordId as jest.Mock).mockResolvedValue({
        id: 'guild-uuid-2',
        ownerId: 'other-user',
        discordGuildId: '785871287053713451',
      });
      (guildsService.userHasGuildAdmin as jest.Mock).mockResolvedValue(true);
      await gateway.handleSubscribe(client, { guildIds: ['785871287053713451'] });
      expect(client.join).toHaveBeenCalledTimes(1);
      expect(client.join).toHaveBeenCalledWith('guild:guild-uuid-2');
      expect(guildsService.userHasGuildAdmin).toHaveBeenCalledWith('user-1', '785871287053713451');
    });
  });

  describe('broadcastToGuild', () => {
    it('emits to room guild:{guildId}', () => {
      const event: GuildStateEventPayload = {
        guildId: 'g-uuid',
        discordGuildId: '123',
        parameter: 'memberCount',
        direction: 'set',
        value: 50,
      };
      gateway.broadcastToGuild('g-uuid', event);
      expect(gateway.server.to).toHaveBeenCalledWith('guild:g-uuid');
      expect(gateway.server.emit).toHaveBeenCalledWith('guild-state', event);
    });
  });
});
