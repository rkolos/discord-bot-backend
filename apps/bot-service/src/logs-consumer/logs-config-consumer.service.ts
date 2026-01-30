import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worker } from 'bullmq';
import { GuildLogSetting } from '@app/shared';
import { RedisService, SharedConfigService } from '@app/shared';

/** Имя очереди (BullMQ). Полный ключ Redis: sn:{env}:workers-queue-logs-config */
const LOGS_CONFIG_QUEUE_NAME = 'workers-queue-logs-config';

export interface LogsConfigJobPayload {
  guild_id: string;
  discord_guild_id: string;
}

const LOG_SETTINGS_CACHE_KEY_PREFIX = 'bot-service:cache:log-settings:';
const LOG_SETTINGS_CACHE_TTL_SEC = 600; // 10 min

@Injectable()
export class LogsConfigConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LogsConfigConsumerService.name);
  private worker: Worker<LogsConfigJobPayload, void> | null = null;

  constructor(
    @InjectRepository(GuildLogSetting)
    private readonly logSettingsRepository: Repository<GuildLogSetting>,
    private readonly sharedConfig: SharedConfigService,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    const { host, port, password, prefix } = this.sharedConfig.redis;
    this.worker = new Worker<LogsConfigJobPayload, void>(
      LOGS_CONFIG_QUEUE_NAME,
      this.processJob.bind(this),
      {
        connection: { host, port, password: password ?? undefined },
        prefix,
        concurrency: 2,
      },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.warn(`LogsConfig job ${job?.id} failed: ${(err as Error).message}`);
    });
    this.logger.log(`Consuming queue ${LOGS_CONFIG_QUEUE_NAME}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }

  private async processJob(job: { data: LogsConfigJobPayload }): Promise<void> {
    const { guild_id } = job.data;
    const rows = await this.logSettingsRepository.find({
      where: { guildId: guild_id },
      select: ['eventType', 'channelId', 'enabled'],
    });
    const cache: Record<string, { channelId: string | null; enabled: boolean }> = {};
    for (const r of rows) {
      cache[r.eventType] = { channelId: r.channelId, enabled: r.enabled };
    }
    const key = `${this.sharedConfig.redis.prefix}${LOG_SETTINGS_CACHE_KEY_PREFIX}${guild_id}`;
    const redis = this.redisService.getClient();
    await redis.set(key, JSON.stringify(cache), 'EX', LOG_SETTINGS_CACHE_TTL_SEC);
  }
}
