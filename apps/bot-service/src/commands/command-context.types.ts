import type { ChatInputCommandInteraction, Client } from 'discord.js';

/**
 * Контекст выполнения slash-команды. Передаётся в AbstractCommand.execute().
 */
export interface CommandContext {
  interaction: ChatInputCommandInteraction;
  guildId: string | null;
  discordGuildId: string;
  client: Client<true>;
  /** Base URL bot-service для вызова внутренних эндпоинтов (например /internal/analytics/overview). */
  internalBaseUrl: string;
}
