import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worker } from 'bullmq';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  Counter,
  CounterMetric,
  CounterStatus,
  COUNTERS_UPDATE_QUEUE_NAME,
  type CounterUpdateJobPayload,
  formatCounterChannelName,
  Guild,
  SharedConfigService,
} from '@app/shared';
import { RedisService } from '@app/shared';
import { MultiTokenConnectionManagerService } from '../multi-token/multi-token-connection-manager.service';
import { SharedAnalyticsService } from '@app/shared';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const RATE_LIMIT_WINDOW_SEC = 10 * 60; // 10 minutes
const RATE_LIMIT_MAX_UPDATES = 2;
const RATE_LIMIT_KEY_PREFIX = 'bot-service:ratelimit:channel:';
const MEMBER_COUNT_CACHE_KEY_PREFIX = 'bot-service:cache:guild:';
const MEMBER_COUNT_SUFFIX = ':member_count';

@Injectable()
export class CountersConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CountersConsumerService.name);
  private worker: Worker<CounterUpdateJobPayload, void> | null = null;

  constructor(
    @InjectRepository(Counter)
    private readonly counterRepository: Repository<Counter>,
    @InjectRepository(Guild)
    private readonly guildRepository: Repository<Guild>,
    private readonly sharedConfig: SharedConfigService,
    private readonly redisService: RedisService,
    private readonly multiToken: MultiTokenConnectionManagerService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly sharedAnalytics: SharedAnalyticsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const { host, port, password, prefix } = this.sharedConfig.redis;
    this.worker = new Worker<CounterUpdateJobPayload, void>(
      COUNTERS_UPDATE_QUEUE_NAME,
      this.processJob.bind(this),
      {
        connection: { host, port, password: password ?? undefined },
        prefix,
        concurrency: 2,
      },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.warn(`Counters job ${job?.id} failed: ${(err as Error).message}`);
    });
    this.logger.log(`Consuming queue ${COUNTERS_UPDATE_QUEUE_NAME}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }

  private async processJob(job: { id?: string; data: CounterUpdateJobPayload }): Promise<void> {
    const { counter_id, guild_id, channel_id, type } = job.data;
    if (type === 'delete') {
      return;
    }

    const counter = await this.counterRepository.findOne({
      where: { id: counter_id },
      relations: ['guild'],
    });
    if (!counter) {
      this.logger.debug(`Counter ${counter_id} not found, skipping`);
      return;
    }

    const guild = await this.guildRepository.findOne({
      where: { id: guild_id },
      select: ['id', 'discordGuildId'],
    });
    if (!guild?.discordGuildId) {
      this.logger.warn(`Guild ${guild_id} not found or missing discordGuildId`);
      return;
    }

    const value = await this.getMetricValue(guild_id, counter.metric);
    const channelName = formatCounterChannelName(counter.template, {
      count: value,
      date: new Date(),
      timezone: counter.timezone,
      dateFormat: counter.dateFormat,
    });

    const redisPrefix = this.sharedConfig.redis.prefix;
    const rateLimitKey = `${redisPrefix}${RATE_LIMIT_KEY_PREFIX}${channel_id}`;
    const canUpdate = await this.checkRateLimit(rateLimitKey);
    if (!canUpdate) {
      this.logger.debug(`Rate limit for channel ${channel_id}, skipping this run`);
      return;
    }

    try {
      await this.setChannelName(guild_id, channel_id, channelName, guild.discordGuildId);
      await this.recordRateLimit(rateLimitKey);
      counter.currentValue = String(value);
      counter.status = CounterStatus.ACTIVE;
      counter.updatedAt = new Date();
      await this.counterRepository.save(counter);
    } catch (err: unknown) {
      const statusCode = (err as { response?: { status?: number } })?.response?.status;
      if (statusCode === 429) {
        throw err;
      }
      counter.status = CounterStatus.ERROR;
      counter.updatedAt = new Date();
      await this.counterRepository.save(counter).catch(() => {});
      throw err;
    }
  }

  private async getMetricValue(guildId: string, metric: string | null): Promise<number> {
    if (metric === CounterMetric.MEMBERS) {
      const redis = this.redisService.getClient();
      const key = `${this.sharedConfig.redis.prefix}${MEMBER_COUNT_CACHE_KEY_PREFIX}${guildId}${MEMBER_COUNT_SUFFIX}`;
      const raw = await redis.get(key);
      if (raw != null) {
        const n = parseInt(raw, 10);
        if (!Number.isNaN(n)) return n;
      }
      // Fallback: guild.memberCount from DB (populated by guild-sync or member events)
      const guild = await this.guildRepository.findOne({
        where: { id: guildId },
        select: ['memberCount'],
      });
      return guild?.memberCount ?? 0;
    }
    if (metric === CounterMetric.MESSAGES) {
      try {
        const overview = await this.sharedAnalytics.getOverviewByGuildId(guildId);
        return overview.totalMessages ?? 0;
      } catch {
        return 0;
      }
    }
    if (metric === CounterMetric.VOICE || metric === CounterMetric.ONLINE || metric === CounterMetric.BOTS) {
      return 0;
    }
    return 0;
  }

  private async checkRateLimit(rateLimitKey: string): Promise<boolean> {
    const redis = this.redisService.getClient();
    const list = await redis.lrange(rateLimitKey, 0, -1);
    const nowSec = Math.floor(Date.now() / 1000);
    const cutoff = nowSec - RATE_LIMIT_WINDOW_SEC;
    const recent = list
      .map((s) => parseInt(s, 10))
      .filter((t) => !Number.isNaN(t) && t > cutoff);
    return recent.length < RATE_LIMIT_MAX_UPDATES;
  }

  private async recordRateLimit(rateLimitKey: string): Promise<void> {
    const redis = this.redisService.getClient();
    const nowSec = String(Math.floor(Date.now() / 1000));
    await redis.lpush(rateLimitKey, nowSec);
    await redis.ltrim(rateLimitKey, 0, RATE_LIMIT_MAX_UPDATES - 1);
    await redis.expire(rateLimitKey, RATE_LIMIT_WINDOW_SEC);
  }

  private async setChannelName(
    guildIdUuid: string,
    channelId: string,
    name: string,
    _discordGuildId: string,
  ): Promise<void> {
    const client = this.multiToken.getClientForGuild(guildIdUuid);
    if (client) {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (channel && 'setName' in channel) {
        await (channel as { setName: (name: string) => Promise<unknown> }).setName(name);
        return;
      }
    }

    const token = this.configService.get<string>('DISCORD_BOT_TOKEN');
    if (!token) {
      throw new Error('DISCORD_BOT_TOKEN not set');
    }
    const url = `${DISCORD_API_BASE}/channels/${channelId}`;
    const response = await firstValueFrom(
      this.httpService.patch(
        url,
        { name },
        {
          headers: {
            Authorization: `Bot ${token}`,
            'Content-Type': 'application/json',
          },
          validateStatus: () => true,
        },
      ),
    );
    if (response.status !== 200) {
      const err = new Error(
        `Discord API PATCH channel failed: ${response.status} ${JSON.stringify(response.data)}`,
      ) as Error & { response?: { status?: number; headers?: Record<string, string>; data?: unknown } };
      err.response = {
        status: response.status,
        headers: response.headers as Record<string, string>,
        data: response.data,
      };
      throw err;
    }
  }
}
