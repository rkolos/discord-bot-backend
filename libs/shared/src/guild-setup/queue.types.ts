import { GUILD_SETUP_QUEUE_NAME } from '../queues/queue-names.constants';

// Реэкспорт константы для обратной совместимости
export { GUILD_SETUP_QUEUE_NAME };

export interface GuildSetupJobPayload {
  discordGuildId: string;
  guildName: string;
  discordOwnerId: string;
}
