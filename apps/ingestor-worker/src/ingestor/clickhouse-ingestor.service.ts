import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ClickHouseService, SharedConfigService } from '@app/shared';
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
        const values = batch.map((e) => toClickHouseRow(e));
        await this.clickhouse.insert({
          table,
          values,
          format: 'JSONEachRow',
        });
        this.logger.debug(`Inserted ${batch.length} events into ${table}`);
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
}

function toClickHouseRow(e: RawEvent): Record<string, unknown> {
  const eventTime = typeof e.eventTime === 'string' ? e.eventTime : e.eventTime.toISOString();
  const eventTimeStr = toClickHouseDateTime(eventTime);
  const eventDate = eventTimeStr.slice(0, 10);
  const retentionUntil = computeRetentionUntil(
    e.eventTime,
    e.planTier ?? 'free',
  );
  const ingestedAt = new Date();

  return {
    event_id: e.eventId,
    event_time: eventTimeStr,
    event_date: eventDate,
    event_type: e.eventType,
    guild_id: e.guildId,
    discord_guild_id: e.discordGuildId,
    user_id: e.userId ?? null,
    discord_user_id: e.discordUserId ?? '',
    anonymized_hash: null,
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
