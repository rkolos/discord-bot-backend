import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not } from 'typeorm';
import { Repository } from 'typeorm';
import { Client, GatewayIntentBits } from 'discord.js';
import { CryptoService, Guild, ServerSettings, SharedConfigService } from '@app/shared';
import { GuildSyncService } from '../guild-sync/guild-sync.service';
import { CommandRegistrationService } from '../commands/command-registration.service';
import { createInteractionHandler } from '../shard/interaction-handler';
import { MultiTokenEventsService } from './multi-token-events.service';

@Injectable()
export class MultiTokenConnectionManagerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MultiTokenConnectionManagerService.name);
  /** guildId (UUID) -> Discord Client */
  private readonly customClients = new Map<string, Client>();
  /** guildId (UUID) -> discordGuildId, для кастомных гильдий (reconciliation). */
  private readonly customGuildDiscordIds = new Map<string, string>();
  private interactionHandler: ReturnType<typeof createInteractionHandler> | null = null;

  constructor(
    @InjectRepository(ServerSettings)
    private readonly serverSettingsRepository: Repository<ServerSettings>,
    @InjectRepository(Guild)
    private readonly guildRepository: Repository<Guild>,
    private readonly crypto: CryptoService,
    private readonly guildSync: GuildSyncService,
    private readonly sharedConfig: SharedConfigService,
    private readonly configService: ConfigService,
    private readonly commandRegistration: CommandRegistrationService,
    private readonly eventsService: MultiTokenEventsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const { host, port, password, prefix } = this.sharedConfig.redis;
    const internalBaseUrl =
      this.configService.get<string>('BOT_SERVICE_INTERNAL_BASE_URL')?.replace(/\/$/, '') ??
      `http://127.0.0.1:${this.configService.get('PORT') ?? this.configService.get('HEALTH_PORT') ?? 3003}`;

    this.interactionHandler = createInteractionHandler({
      redisHost: host,
      redisPort: port,
      redisPassword: password ?? undefined,
      redisPrefix: prefix,
      internalBaseUrl,
      getGuildId: async (discordGuildId: string) => {
        const guild = await this.guildRepository.findOne({
          where: { discordGuildId },
          select: ['id'],
        });
        return guild?.id ?? null;
      },
    });

    const settingsList = await this.serverSettingsRepository.find({
      where: { botTokenEncrypted: Not(IsNull()) },
      relations: ['guild'],
    });

    for (const settings of settingsList) {
      if (!settings.botTokenEncrypted || !settings.guildId) continue;
      let token: string;
      try {
        token = this.crypto.decrypt(settings.botTokenEncrypted);
      } catch (err) {
        this.logger.warn(
          `Failed to decrypt token for guild ${settings.guildId}: ${(err as Error).message}`,
        );
        continue;
      }

      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.GuildVoiceStates,
        ],
      });

      const guildIdUuid = settings.guildId;
      const discordGuildId = settings.guild?.discordGuildId;
      const handler = this.interactionHandler;

      client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        try {
          if (handler) await handler.handle(interaction, client as import('discord.js').Client<true>);
        } catch (err) {
          this.logger.warn(`interactionCreate error: ${(err as Error).message}`);
        }
      });

      client.once('ready', async () => {
        const botUserId = client.user?.id ?? null;
        if (botUserId) {
          await this.guildSync.onReady({
            discordGuildId: discordGuildId ?? '',
            botUserId,
            shardId: 0,
            guildIdUuid,
            isCustomToken: true,
          });
        }
        if (discordGuildId) {
          try {
            await this.commandRegistration.registerGuildCommands(token, discordGuildId);
          } catch (err) {
            this.logger.warn(
              `Failed to register guild commands for ${discordGuildId}: ${(err as Error).message}`,
            );
          }
        }
        this.logger.log(`Custom token client READY for guild ${guildIdUuid}`);
      });

      client.on('guildCreate', async (guild) => {
        try {
          await this.guildSync.onGuildCreate({
            discordGuildId: guild.id,
            guildName: guild.name,
            shardId: 0,
          });
        } catch (err) {
          this.logger.warn(`guildCreate sync error: ${(err as Error).message}`);
        }
      });

      client.on('guildDelete', async (guild) => {
        try {
          await this.guildSync.onGuildDelete({
            discordGuildId: guild.id,
          });
        } catch (err) {
          this.logger.warn(`guildDelete sync error: ${(err as Error).message}`);
        }
      });

      client.on('guildMemberAdd', async (member) => {
        try {
          await this.eventsService.onGuildMemberAdd(member, client as import('discord.js').Client<true>);
        } catch (err) {
          this.logger.warn(`guildMemberAdd error: ${(err as Error).message}`);
        }
      });

      client.on('guildMemberRemove', async (member) => {
        try {
          await this.eventsService.onGuildMemberRemove(member, client as import('discord.js').Client<true>);
        } catch (err) {
          this.logger.warn(`guildMemberRemove error: ${(err as Error).message}`);
        }
      });

      client.on('messageDelete', async (message) => {
        try {
          await this.eventsService.onMessageDelete(message, client as import('discord.js').Client<true>);
        } catch (err) {
          this.logger.warn(`messageDelete error: ${(err as Error).message}`);
        }
      });

      client.on('messageUpdate', async (oldMessage, newMessage) => {
        try {
          await this.eventsService.onMessageUpdate(oldMessage, newMessage, client as import('discord.js').Client<true>);
        } catch (err) {
          this.logger.warn(`messageUpdate error: ${(err as Error).message}`);
        }
      });

      client.on('voiceStateUpdate', async (oldState, newState) => {
        try {
          await this.eventsService.onVoiceStateUpdate(oldState, newState, client as import('discord.js').Client<true>);
        } catch (err) {
          this.logger.warn(`voiceStateUpdate error: ${(err as Error).message}`);
        }
      });

      client.on('guildMemberUpdate', async (oldMember, newMember) => {
        try {
          await this.eventsService.onGuildMemberUpdate(oldMember, newMember, client as import('discord.js').Client<true>);
        } catch (err) {
          this.logger.warn(`guildMemberUpdate error: ${(err as Error).message}`);
        }
      });

      try {
        await client.login(token);
        this.customClients.set(guildIdUuid, client);
        if (discordGuildId) {
          this.customGuildDiscordIds.set(guildIdUuid, discordGuildId);
        }
      } catch (err) {
        this.logger.warn(
          `Failed to login custom token for guild ${guildIdUuid}: ${(err as Error).message}`,
        );
        client.destroy();
      }
    }

    this.logger.log(`Multi-token: ${this.customClients.size} custom client(s) started`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.interactionHandler?.destroy) {
      await this.interactionHandler.destroy();
      this.interactionHandler = null;
    }
    const destroyPromises = Array.from(this.customClients.values()).map(
      (client) => client.destroy(),
    );
    await Promise.all(destroyPromises);
    this.customClients.clear();
    this.customGuildDiscordIds.clear();
    this.logger.log('Multi-token: all custom clients destroyed');
  }

  /**
   * Список кастомных гильдий для reconciliation: guildId (UUID) → discordGuildId.
   */
  getCustomGuildIds(): Map<string, string> {
    return new Map(this.customGuildDiscordIds);
  }

  /**
   * Проверяет, что гильдия с кастомным токеном присутствует в кэше клиента (бот в гильдии).
   */
  isGuildInCache(guildIdUuid: string): boolean {
    const client = this.customClients.get(guildIdUuid);
    const discordGuildId = this.customGuildDiscordIds.get(guildIdUuid);
    if (!client || !discordGuildId) return false;
    return client.guilds.cache.has(discordGuildId);
  }

  /**
   * Возвращает true, если для гильдии (по UUID в БД) используется кастомный токен.
   */
  hasCustomTokenForGuild(guildIdUuid: string): boolean {
    return this.customClients.has(guildIdUuid);
  }

  /**
   * Для тестов и логики выбора: использовать кастомный клиент для гильдии или основной бот.
   */
  getTokenKindForGuild(guildIdUuid: string): 'main' | 'custom' {
    return this.hasCustomTokenForGuild(guildIdUuid) ? 'custom' : 'main';
  }

  /**
   * Возвращает Discord Client для гильдии с кастомным токеном, иначе null.
   */
  getClientForGuild(guildIdUuid: string): Client | null {
    return this.customClients.get(guildIdUuid) ?? null;
  }
}
