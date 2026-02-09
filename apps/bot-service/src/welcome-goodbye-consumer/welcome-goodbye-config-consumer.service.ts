import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worker } from 'bullmq';
import { GuildWelcomeGoodbyeSetting } from '@app/shared';
import { RedisService, SharedConfigService } from '@app/shared';

/** Имя очереди (BullMQ). Полный ключ Redis: sn:{env}:workers-queue-welcome-goodbye-config */
const WELCOME_GOODBYE_CONFIG_QUEUE_NAME = 'workers-queue-welcome-goodbye-config';

export interface WelcomeGoodbyeConfigJobPayload {
  guild_id: string;
  discord_guild_id: string;
}

export interface WelcomeGoodbyeSettingCache {
  channelId: string | null;
  enabled: boolean;
  messageType: string;
  contentText: string | null;
  contentEmbed: { title?: string; description?: string; color?: number; fields?: { name: string; value: string }[] } | null;
}

export interface WelcomeGoodbyeCache {
  welcome: WelcomeGoodbyeSettingCache;
  goodbye: WelcomeGoodbyeSettingCache;
}

const WELCOME_GOODBYE_CACHE_KEY_PREFIX = 'bot-service:cache:welcome-goodbye:';
const WELCOME_GOODBYE_CACHE_TTL_SEC = 600; // 10 min

const DEFAULT_SETTING: WelcomeGoodbyeSettingCache = {
  channelId: null,
  enabled: false,
  messageType: 'text',
  contentText: null,
  contentEmbed: null,
};

function toCacheSetting(row: GuildWelcomeGoodbyeSetting | null): WelcomeGoodbyeSettingCache {
  if (!row) return { ...DEFAULT_SETTING };
  return {
    channelId: row.channelId,
    enabled: row.enabled,
    messageType: row.messageType,
    contentText: row.contentText,
    contentEmbed: row.contentEmbed,
  };
}

@Injectable()
export class WelcomeGoodbyeConfigConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WelcomeGoodbyeConfigConsumerService.name);
  private worker: Worker<WelcomeGoodbyeConfigJobPayload, void> | null = null;

  constructor(
    @InjectRepository(GuildWelcomeGoodbyeSetting)
    private readonly settingsRepository: Repository<GuildWelcomeGoodbyeSetting>,
    private readonly sharedConfig: SharedConfigService,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    const { host, port, password, prefix } = this.sharedConfig.redis;
    this.worker = new Worker<WelcomeGoodbyeConfigJobPayload, void>(
      WELCOME_GOODBYE_CONFIG_QUEUE_NAME,
      this.processJob.bind(this),
      {
        connection: { host, port, password: password ?? undefined },
        prefix,
        concurrency: 2,
      },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.warn(`WelcomeGoodbyeConfig job ${job?.id} failed: ${(err as Error).message}`);
    });
    this.logger.log(`Consuming queue ${WELCOME_GOODBYE_CONFIG_QUEUE_NAME}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }

  private async processJob(job: { data: WelcomeGoodbyeConfigJobPayload }): Promise<void> {
    const { guild_id } = job.data;
    const rows = await this.settingsRepository.find({
      where: { guildId: guild_id },
      select: ['type', 'channelId', 'enabled', 'messageType', 'contentText', 'contentEmbed'],
    });
    const welcomeRow = rows.find((r) => r.type === 'welcome') ?? null;
    const goodbyeRow = rows.find((r) => r.type === 'goodbye') ?? null;
    const cache: WelcomeGoodbyeCache = {
      welcome: toCacheSetting(welcomeRow),
      goodbye: toCacheSetting(goodbyeRow),
    };
    const key = `${this.sharedConfig.redis.prefix}${WELCOME_GOODBYE_CACHE_KEY_PREFIX}${guild_id}`;
    const redis = this.redisService.getClient();
    await redis.set(key, JSON.stringify(cache), 'EX', WELCOME_GOODBYE_CACHE_TTL_SEC);
  }
}
