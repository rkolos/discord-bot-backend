import {
  EmbedBuilder,
  type APIEmbedField,
} from 'discord.js';
import { AbstractCommand } from './abstract.command';
import type { CommandContext } from './command-context.types';
import type { SlashCommandData } from './abstract.command';

const OVERVIEW_PATH = '/internal/analytics/overview';

export class StatsCommand extends AbstractCommand {
  readonly name = 'stats';

  data(): SlashCommandData {
    return {
      name: this.name,
      description: 'Ключевые метрики сервера за 30 дней',
      type: 1,
    };
  }

  async execute(context: CommandContext): Promise<void> {
    if (!context.guildId) {
      await context.interaction.reply({
        content: 'Не удалось определить сервер. Попробуйте позже.',
        ephemeral: true,
      });
      return;
    }

    const url = `${context.internalBaseUrl.replace(/\/$/, '')}${OVERVIEW_PATH}?guildId=${encodeURIComponent(context.guildId)}`;
    let overview: { totalMessages: number; activeMembers24h: number; activeMembers7d: number };

    try {
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(process.env['INTERNAL_API_SECRET'] && {
            'X-Internal-Secret': process.env['INTERNAL_API_SECRET'],
          }),
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Overview failed: ${res.status} ${text}`);
      }
      overview = (await res.json()) as {
        totalMessages: number;
        activeMembers24h: number;
        activeMembers7d: number;
      };
    } catch (err) {
      const msg = (err as Error).message;
      await context.interaction.reply({
        content: `Не удалось загрузить аналитику: ${msg}`,
        ephemeral: true,
      });
      return;
    }

    const fields: APIEmbedField[] = [
      { name: 'Сообщений (30 дней)', value: String(overview.totalMessages), inline: true },
      { name: 'Активных за 24 ч', value: String(overview.activeMembers24h), inline: true },
      { name: 'Активных за 7 дней', value: String(overview.activeMembers7d), inline: true },
    ];

    const embed = new EmbedBuilder()
      .setTitle('Статистика сервера')
      .setDescription('Ключевые метрики за последние 30 дней')
      .addFields(...fields)
      .setColor(0x5865f2)
      .setTimestamp();

    await context.interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
