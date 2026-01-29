import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import type { ClickHouseClient } from '@clickhouse/client';
import { SharedConfigService } from '../config/shared-config.service';
import { CLICKHOUSE_CLIENT } from './clickhouse.constants';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;
const RETRY_BACKOFF_MULTIPLIER = 1.5;

export interface ClickHouseQueryParams {
  query: string;
  query_params?: Record<string, unknown>;
}

export interface ClickHouseInsertParams {
  table: string;
  values: unknown[];
  format: 'JSONEachRow';
}

@Injectable()
export class ClickHouseService implements OnModuleInit {
  private readonly logger = new Logger(ClickHouseService.name);

  constructor(
    @Inject(CLICKHOUSE_CLIENT)
    private readonly client: ClickHouseClient,
    private readonly sharedConfig: SharedConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.waitForConnection();
    this.logger.log('ClickHouse connection established');
    await this.runMigrations();
  }

  /**
   * Выполнение SELECT с поддержкой параметров (защита от SQL-инъекций через query_params).
   */
  async query(params: ClickHouseQueryParams): Promise<ReturnType<ClickHouseClient['query']>> {
    const { query, query_params } = params;
    return this.client.query({
      query,
      query_params,
      format: 'JSONEachRow',
    });
  }

  /**
   * Выполнение DDL/DML без возврата курсора (CREATE TABLE, CREATE MV и т.д.).
   */
  async exec(params: ClickHouseQueryParams): Promise<void> {
    const { query, query_params } = params;
    await this.client.command({
      query,
      query_params,
      clickhouse_settings: { wait_end_of_query: 1 },
    });
  }

  /**
   * Вставка данных. Параметризация через структуру values, не конкатенация SQL.
   */
  async insert(params: ClickHouseInsertParams): Promise<{ query_id: string; executed: boolean }> {
    const { table, values, format } = params;
    return this.client.insert({
      table,
      values,
      format,
    });
  }

  private async waitForConnection(): Promise<void> {
    let delay = RETRY_DELAY_MS;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const result = await this.client.ping();
      if (result.success) {
        return;
      }
      this.logger.warn(
        `ClickHouse unavailable (attempt ${attempt}/${MAX_RETRIES}): ${result.error?.message ?? 'unknown'}`,
      );
      if (attempt < MAX_RETRIES) {
        await this.sleep(delay);
        delay = Math.min(delay * RETRY_BACKOFF_MULTIPLIER, 10000);
      } else {
        this.logger.error('ClickHouse connection failed after max retries');
        throw result.error ?? new Error('ClickHouse connection failed');
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async runMigrations(): Promise<void> {
    const database = this.sharedConfig.clickhouse.database || 'default';
    const tableRawEvents = `${database}.raw_events`;

    await this.exec({
      query: `
        CREATE TABLE IF NOT EXISTS ${tableRawEvents}
        (
          event_id UUID,
          event_time DateTime,
          event_date Date DEFAULT toDate(event_time),
          event_type LowCardinality(String) DEFAULT '',
          guild_id UUID,
          discord_guild_id String DEFAULT '',
          user_id Nullable(UUID),
          discord_user_id String DEFAULT '',
          anonymized_hash Nullable(String),
          channel_id String DEFAULT '',
          role_id String DEFAULT '',
          command_name String DEFAULT '',
          plan_tier LowCardinality(String) DEFAULT '',
          is_bot_generated UInt8 DEFAULT 0,
          payload String DEFAULT '',
          ingested_at DateTime,
          retention_until DateTime,
          is_historical UInt8 DEFAULT 0
        )
        ENGINE = MergeTree
        PARTITION BY toStartOfWeek(event_time)
        ORDER BY (guild_id, event_date, event_type, user_id)
        TTL retention_until
        SETTINGS allow_nullable_key = 1
      `,
    });

    const mvDailyActivity = `
      CREATE MATERIALIZED VIEW IF NOT EXISTS ${database}.mv_daily_activity
      ENGINE = AggregatingMergeTree
      PARTITION BY toStartOfWeek(event_date)
      ORDER BY (guild_id, event_date)
      AS SELECT
        guild_id,
        event_date,
        countIfState(event_type = 'MESSAGE_CREATE') AS messages_count,
        countIfState(event_type = 'GUILD_MEMBER_ADD') AS members_joined,
        sumState(if(event_type = 'VOICE_STATE_UPDATE', toUInt64(JSONExtractInt(payload, 'voiceMinutes')), 0)) AS voice_minutes,
        uniqCombinedState(user_id) AS unique_users_count
      FROM ${tableRawEvents}
      GROUP BY guild_id, event_date
    `;
    await this.exec({ query: mvDailyActivity });

    const mvHeatmap = `
      CREATE MATERIALIZED VIEW IF NOT EXISTS ${database}.mv_heatmap
      ENGINE = SummingMergeTree
      PARTITION BY toStartOfWeek(event_date)
      ORDER BY (guild_id, day_of_week, hour)
      AS SELECT
        guild_id,
        toDayOfWeek(event_time) AS day_of_week,
        toHour(event_time) AS hour,
        event_date,
        count() AS events_count
      FROM ${tableRawEvents}
      WHERE event_type = 'MESSAGE_CREATE'
      GROUP BY guild_id, day_of_week, hour, event_date
    `;
    await this.exec({ query: mvHeatmap });

    const mvRoleStats = `
      CREATE MATERIALIZED VIEW IF NOT EXISTS ${database}.mv_role_stats
      ENGINE = SummingMergeTree
      PARTITION BY toStartOfWeek(event_date)
      ORDER BY (guild_id, role_id, event_date)
      AS SELECT
        guild_id,
        role_id,
        event_date,
        count() AS events_count
      FROM ${tableRawEvents}
      WHERE role_id != ''
      GROUP BY guild_id, role_id, event_date
    `;
    await this.exec({ query: mvRoleStats });

    const mvCommandStats = `
      CREATE MATERIALIZED VIEW IF NOT EXISTS ${database}.mv_command_stats
      ENGINE = SummingMergeTree
      PARTITION BY toStartOfWeek(event_date)
      ORDER BY (guild_id, command_name, event_date)
      AS SELECT
        guild_id,
        command_name,
        event_date,
        count() AS execution_count,
        sumIf(1, JSONExtractBool(payload, 'isError') = 1) AS error_count
      FROM ${tableRawEvents}
      WHERE command_name != ''
      GROUP BY guild_id, command_name, event_date
    `;
    await this.exec({ query: mvCommandStats });

    const mvTopMembers = `
      CREATE MATERIALIZED VIEW IF NOT EXISTS ${database}.mv_top_members
      ENGINE = SummingMergeTree
      PARTITION BY toStartOfWeek(event_date)
      ORDER BY (guild_id, user_id)
      SETTINGS allow_nullable_key = 1
      AS SELECT
        guild_id,
        user_id,
        event_date,
        sumIf(1, event_type = 'MESSAGE_CREATE') AS message_count,
        sumIf(toUInt64(JSONExtractInt(payload, 'voiceMinutes')), event_type = 'VOICE_STATE_UPDATE') AS voice_minutes
      FROM ${tableRawEvents}
      WHERE is_bot_generated = 0
      GROUP BY guild_id, user_id, event_date
    `;
    await this.exec({ query: mvTopMembers });
  }
}
