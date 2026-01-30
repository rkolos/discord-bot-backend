import { PingCommand } from './ping.command';
import type { CommandContext } from './command-context.types';

describe('PingCommand', () => {
  const command = new PingCommand();

  it('data() returns valid slash command definition', () => {
    const data = command.data();
    expect(data.name).toBe('ping');
    expect(data.description).toBeDefined();
    expect(data.description.length).toBeGreaterThan(0);
    expect(data.type).toBe(1);
  });

  it('execute() replies with content containing WebSocket ping', async () => {
    const reply = jest.fn().mockResolvedValue(undefined);
    const context: CommandContext = {
      interaction: {
        isChatInputCommand: () => true,
        reply,
      } as unknown as CommandContext['interaction'],
      guildId: null,
      discordGuildId: '123',
      client: {
        ws: { ping: 42 },
      } as unknown as CommandContext['client'],
      internalBaseUrl: 'http://localhost:3003',
    };

    await command.execute(context);

    expect(reply).toHaveBeenCalledTimes(1);
    const call = reply.mock.calls[0][0];
    expect(call).toHaveProperty('content');
    expect(typeof call.content).toBe('string');
    expect(call.content).toContain('Pong');
    expect(call.content).toContain('42');
    expect(call.ephemeral).toBe(true);
  });
});
