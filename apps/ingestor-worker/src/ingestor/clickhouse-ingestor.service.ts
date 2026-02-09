import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  ClickHouseService,
  SharedConfigService,
  RedisService,
  computeAnonymizedHash,
  publishGuildStateEvent,
} from '@app/shared';
import type { RawEvent } from './ingestor.types';
import { computeRetentionUntil } from './retention.helper';

const MAX_INSERT_RETRIES = 5;
const INSERT_RETRY_DELAY_MS = 1000;
const INSERT_RETRY_BACKOFF = 1.5;

@Injectable()
export class ClickHouseIngestorService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ClickHouseIngestorService.name);
  private readonly buffer: RawEvent[] = [];
  private lastFlushAt = 0;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly clickhouse: ClickHouseService,
    private readonly config: SharedConfigService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit(): void {
    const { batchIntervalMs } = this.config.ingestor;
    this.lastFlushAt = Date.now();
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) this.flush();
    }, batchIntervalMs);
    this.logger.log(
      `Ingestor buffer started (batchSize=${this.config.ingestor.batchSize}, intervalMs=${batchIntervalMs})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.buffer.length > 0) {
      this.logger.log(`Flushing ${this.buffer.length} events on shutdown`);
      await this.flush();
    }
  }

  pushEvent(event: RawEvent): void {
    this.buffer.push(event);
    const { batchSize, batchIntervalMs } = this.config.ingestor;
    if (
      this.buffer.length >= batchSize ||
      (this.buffer.length > 0 &&
        Date.now() - this.lastFlushAt >= batchIntervalMs)
    ) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.buffer.length);
    this.lastFlushAt = Date.now();

    let delay = INSERT_RETRY_DELAY_MS;
    for (let attempt = 1; attempt <= MAX_INSERT_RETRIES; attempt++) {
      try {
        const table = `${this.config.clickhouse.database || 'default'}.raw_events`;
        const salt = this.config.auth.anonymizationSalt;
        const values = batch.map((e) => toClickHouseRow(e, salt));
        await this.clickhouse.insert({
          table,
          values,
          format: 'JSONEachRow',
        });
        const guildIds = [...new Set(batch.map((e) => e.guildId))];
        this.logger.log(
          `[analytics] ClickHouse insert count=${batch.length} guildIds=[${guildIds.slice(0, 3).join(', ')}${guildIds.length > 3 ? '...' : ''}]`,
        );
        const messageGuilds = batch
          .filter((e) => e.eventType === 'MESSAGE_CREATE')
          .reduce(
            (acc, e) => {
              if (!acc.has(e.guildId)) acc.set(e.guildId, e.discordGuildId);
              return acc;
            },
            new Map<string, string>(),
          );
        const messageCountKeySuffix = 'bot-service:guild-state:message-count:';
        for (const [guildId, discordGuildId] of messageGuilds) {
          const newTotal = await this.getTotalMessagesCount(guildId);
          await this.redis.getClient().set(messageCountKeySuffix + guildId, String(newTotal)).catch(() => {});
          publishGuildStateEvent(this.redis.getClient(), this.config.redis.prefix, {
            guildId,
            discordGuildId,
            parameter: 'totalMessages',
            direction: 'set',
            value: newTotal,
          });
        }
        return;
      } catch (err) {
        this.logger.warn(
          `ClickHouse insert failed (attempt ${attempt}/${MAX_INSERT_RETRIES}): ${(err as Error).message}`,
        );
        if (attempt === MAX_INSERT_RETRIES) {
          for (const e of batch) this.buffer.unshift(e);
          throw err;
        }
        await sleep(delay);
        delay = Math.min(
          Math.floor(delay * INSERT_RETRY_BACKOFF),
          30_000,
        );
      }
    }
  }

  /** Для тестов: текущий размер буфера. */
  getBufferLength(): number {
    return this.buffer.length;
  }

  /** Количество MESSAGE_CREATE по гильдии в raw_events (для guild-state totalMessages). */
  private async getTotalMessagesCount(guildId: string): Promise<number> {
    const db = this.config.clickhouse.database || 'default';
    try {
      const result = await this.clickhouse.query({
        query: `SELECT count() AS total
                FROM ${db}.raw_events
                WHERE guild_id = toUUID({guildId:String}) AND event_type = 'MESSAGE_CREATE'`,
        query_params: { guildId },
      });
      const json = (await result.json()) as
        | Array<{ total: string | number }>
        | { data?: Array<{ total: string | number }> };
      const rows = Array.isArray(json) ? json : (json.data ?? []);
      const total = rows[0]?.total;
      return typeof total === 'number' ? total : Number(total ?? 0);
    } catch {
      return 0;
    }
  }
}

function toClickHouseRow(
  e: RawEvent,
  salt: string,
): Record<string, unknown> {
  const eventTime = typeof e.eventTime === 'string' ? e.eventTime : e.eventTime.toISOString();
  const eventTimeStr = toClickHouseDateTime(eventTime);
  const eventDate = eventTimeStr.slice(0, 10);
  const retentionUntil = computeRetentionUntil(
    e.eventTime,
    e.planTier ?? 'free',
  );
  const ingestedAt = new Date();

  const shouldAnonymize =
    e.anonymizeUserData === true &&
    e.discordUserId != null &&
    String(e.discordUserId).trim() !== '';
  const anonymizedHash =
    shouldAnonymize && salt
      ? computeAnonymizedHash(String(e.discordUserId), salt)
      : null;
  const discordUserIdForRow = shouldAnonymize ? '' : (e.discordUserId ?? '');

  return {
    event_id: e.eventId,
    event_time: eventTimeStr,
    event_date: eventDate,
    event_type: e.eventType,
    guild_id: e.guildId,
    discord_guild_id: e.discordGuildId,
    user_id: e.userId ?? null,
    discord_user_id: discordUserIdForRow,
    anonymized_hash: anonymizedHash,
    channel_id: e.channelId ?? '',
    role_id: e.roleId ?? '',
    command_name: e.commandName ?? '',
    plan_tier: e.planTier ?? 'free',
    is_bot_generated: e.isBotGenerated ? 1 : 0,
    payload: e.payload,
    ingested_at: toClickHouseDateTime(ingestedAt.toISOString()),
    retention_until: toClickHouseDateTime(retentionUntil.toISOString()),
    is_historical: e.isHistorical ? 1 : 0,
  };
}

/** ClickHouse DateTime: YYYY-MM-DD HH:MM:SS */
function toClickHouseDateTime(iso: string): string {
  return iso.replace('T', ' ').replace('Z', '').slice(0, 19);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
