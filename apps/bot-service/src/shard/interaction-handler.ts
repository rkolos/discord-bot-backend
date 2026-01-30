/**
 * Обработчик interactionCreate для shard-worker и multi-token.
 * Формирует payload для BullMQ и выполняет команду через CommandRegistry.
 * Не зависит от NestJS.
 */
import { Queue } from 'bullmq';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import { randomUUID } from 'crypto';
import { CommandRegistry } from '../commands/command.registry';
import {
  INGESTOR_RAW_EVENTS_QUEUE_NAME,
  type RawEventJobPayload,
} from '../raw-events/raw-events-queue.types';

export interface InteractionHandlerOptions {
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
  redisPrefix: string;
  internalBaseUrl: string;
  getGuildId: (discordGuildId: string) => Promise<string | null>;
}

export function createInteractionHandler(options: InteractionHandlerOptions) {
  const {
    redisHost,
    redisPort,
    redisPassword,
    redisPrefix,
    internalBaseUrl,
    getGuildId,
  } = options;

  const queue = new Queue<RawEventJobPayload>(INGESTOR_RAW_EVENTS_QUEUE_NAME, {
    connection: {
      host: redisHost,
      port: redisPort,
      password: redisPassword,
    },
    prefix: redisPrefix,
  });

  const registry = new CommandRegistry();

  return {
    async handle(interaction: ChatInputCommandInteraction, client: Client<true>): Promise<void> {
      if (!interaction.isChatInputCommand()) return;

      const discordGuildId = interaction.guildId ?? interaction.guild?.id ?? '';
      const guildId = discordGuildId ? await getGuildId(discordGuildId) : null;

      const payload: RawEventJobPayload = {
        eventId: randomUUID(),
        eventType: 'INTERACTION_CREATE',
        eventTime: new Date().toISOString(),
        guildId: guildId ?? '',
        discordGuildId,
        discordUserId: interaction.user?.id ?? null,
        channelId: interaction.channelId ?? null,
        commandName: interaction.commandName ?? null,
        payload: {
          commandName: interaction.commandName,
          commandId: interaction.commandId,
        } as Record<string, unknown>,
        isBotGenerated: true,
      };

      await queue.add('interaction', payload, { priority: 0 }).catch((err) => {
        console.error(`[interaction-handler] Failed to enqueue: ${(err as Error).message}`);
      });

      const command = registry.getByName(interaction.commandName);
      if (!command) {
        await interaction.reply({ content: 'Неизвестная команда.', ephemeral: true }).catch(() => {});
        return;
      }

      const context = {
        interaction,
        guildId,
        discordGuildId,
        client,
        internalBaseUrl,
      };

      try {
        await command.execute(context);
      } catch (err) {
        const msg = (err as Error).message;
        await interaction
          .reply({ content: `Ошибка: ${msg}`, ephemeral: true })
          .catch(() => {});
      }
    },
    destroy(): Promise<void> {
      return queue.close();
    },
  };
}
