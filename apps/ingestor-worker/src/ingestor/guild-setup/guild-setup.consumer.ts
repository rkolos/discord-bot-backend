import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Guild,
  GuildStatus,
  GuildSubscriptionTier,
  GUILD_SETUP_QUEUE_NAME,
  type GuildSetupJobPayload,
  HISTORY_SYNC_QUEUE_NAME,
  type HistorySyncJobPayload,
  ServerSettings,
  User,
  UserPlan,
  UserStatus,
  SharedConfigService,
} from '@app/shared';
import { Queue } from 'bullmq';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DEFAULT_GUILD_NAME = 'Server';
const DEFAULT_LANGUAGE = 'en';

@Injectable()
export class GuildSetupConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GuildSetupConsumer.name);
  private worker: Worker<GuildSetupJobPayload, void> | null = null;
  private historySyncQueue: Queue<HistorySyncJobPayload> | null = null;

  constructor(
    private readonly config: SharedConfigService,
    private readonly configService: ConfigService,
    @InjectRepository(Guild)
    private readonly guildRepository: Repository<Guild>,
    @InjectRepository(ServerSettings)
    private readonly serverSettingsRepository: Repository<ServerSettings>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async onModuleInit(): Promise<void> {
    const { host, port, password, prefix } = this.config.redis;
    this.historySyncQueue = new Queue<HistorySyncJobPayload>(HISTORY_SYNC_QUEUE_NAME, {
      connection: { host, port, password: password ?? undefined },
      prefix,
    });
    this.worker = new Worker<GuildSetupJobPayload, void>(
      GUILD_SETUP_QUEUE_NAME,
      this.processJob.bind(this),
      {
        connection: { host, port, password: password ?? undefined },
        prefix,
        concurrency: 1,
      },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.warn(`Guild setup job ${job?.id} failed: ${(err as Error).message}`);
    });
    this.logger.log(`Consuming queue ${GUILD_SETUP_QUEUE_NAME}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    if (this.historySyncQueue) {
      await this.historySyncQueue.close();
      this.historySyncQueue = null;
    }
  }

  private async processJob(job: {
    id?: string;
    data: GuildSetupJobPayload;
  }): Promise<void> {
    const { discordGuildId, guildName, discordOwnerId } = job.data;
    if (!discordGuildId || !discordOwnerId) {
      this.logger.warn(`Guild setup job ${job.id}: missing discordGuildId or discordOwnerId`);
      return;
    }

    const existing = await this.guildRepository.findOne({
      where: { discordGuildId },
    });
    if (existing) {
      this.logger.log(`Guild setup job ${job.id}: guild already exists, enqueueing history:sync`);
      await this.historySyncQueue!.add('history-sync', { guildId: existing.id, discordGuildId }, { priority: 10 });
      return;
    }

    const token = this.configService.get<string>('DISCORD_BOT_TOKEN');
    if (!token) {
      this.logger.error('Guild setup: DISCORD_BOT_TOKEN not set');
      throw new Error('DISCORD_BOT_TOKEN not set');
    }

    let user = await this.userRepository.findOne({
      where: { discordId: discordOwnerId },
    });
    if (!user) {
      const discordUser = await this.fetchDiscordUser(discordOwnerId, token);
      user = this.userRepository.create({
        discordId: discordOwnerId,
        username: discordUser.username ?? `user_${discordOwnerId.slice(-8)}`,
        discriminator: discordUser.discriminator ?? null,
        avatarUrl: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordOwnerId}/${discordUser.avatar}.png` : null,
        email: null,
        passwordHash: null,
        plan: UserPlan.FREE,
        status: UserStatus.ACTIVE,
      });
      await this.userRepository.save(user);
    }

    const serverName = guildName?.trim() || DEFAULT_GUILD_NAME;
    const guild = this.guildRepository.create({
      discordGuildId,
      name: serverName,
      iconUrl: null,
      banner: null,
      ownerId: user.id,
      status: GuildStatus.ACTIVE,
      subscriptionTier: GuildSubscriptionTier.FREE,
      memberCount: 0,
      messageCount: '0',
      onlineMembers: null,
      memberGrowth: null,
      lastActivity: null,
      shardId: null,
      isBotInGuild: true,
    });
    const savedGuild = await this.guildRepository.save(guild);

    const settings = this.serverSettingsRepository.create({
      guildId: savedGuild.id,
      serverName,
      serverDescription: null,
      language: DEFAULT_LANGUAGE,
      timezone: 'UTC',
      botTokenEncrypted: null,
      botConnected: false,
      botUserId: null,
      lastConnected: null,
      lastSyncAt: null,
      dataRetentionDays: 0,
      anonymizeUserData: true,
      shareAnalytics: true,
      allowPublicWidgets: true,
      updatedAt: new Date(),
    });
    await this.serverSettingsRepository.save(settings);

    await this.historySyncQueue!.add(
      'history-sync',
      { guildId: savedGuild.id, discordGuildId },
      { priority: 10 },
    );

    const baseUrl = this.configService.get<string>('BOT_SERVICE_INTERNAL_BASE_URL');
    if (baseUrl) {
      const url = `${baseUrl.replace(/\/$/, '')}/internal/guilds/${savedGuild.id}/sync`;
      const secret = this.configService.get<string>('INTERNAL_API_SECRET');
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(secret && { 'X-Internal-Secret': secret }),
        },
      }).catch((err) => {
        this.logger.warn(`Guild sync HTTP error: ${(err as Error).message}`);
      });
    }

    this.logger.log(`Guild setup job ${job.id}: created guild ${savedGuild.id}, enqueued history:sync`);
  }

  private async fetchDiscordUser(userId: string, token: string): Promise<{ username?: string; discriminator?: string; avatar?: string }> {
    const res = await fetch(`${DISCORD_API_BASE}/users/${userId}`, {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!res.ok) {
      this.logger.warn(`Discord API GET /users/${userId} failed: ${res.status}`);
      return {};
    }
    const data = (await res.json()) as { username?: string; discriminator?: string; avatar?: string };
    return data;
  }
}
