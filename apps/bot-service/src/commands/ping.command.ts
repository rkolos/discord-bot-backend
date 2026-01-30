import { AbstractCommand } from './abstract.command';
import type { CommandContext } from './command-context.types';
import type { SlashCommandData } from './abstract.command';

export class PingCommand extends AbstractCommand {
  readonly name = 'ping';

  data(): SlashCommandData {
    return {
      name: this.name,
      description: 'Показать задержку API и WebSocket',
      type: 1,
    };
  }

  async execute(context: CommandContext): Promise<void> {
    const wsPing = context.client.ws.ping;
    const content = `Pong! WebSocket: **${wsPing} ms**`;
    await context.interaction.reply({ content, ephemeral: true });
  }
}
