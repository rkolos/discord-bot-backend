/** Имя очереди (BullMQ). Полный ключ Redis: sn:{env}:workers-queue-guild-setup */
export const GUILD_SETUP_QUEUE_NAME = 'workers-queue-guild-setup';

export interface GuildSetupJobPayload {
  discordGuildId: string;
  guildName: string;
  discordOwnerId: string;
}
