import { Injectable } from '@nestjs/common';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { SharedConfigService } from '../config/shared-config.service';
import type {
  ActivityChartPointDto,
  AnalyticsOverviewDto,
  TopMemberDto,
} from './analytics.types';

@Injectable()
export class SharedAnalyticsService {
  constructor(
    private readonly clickhouse: ClickHouseService,
    private readonly sharedConfig: SharedConfigService,
  ) {}

  private getDatabase(): string {
    return this.sharedConfig.clickhouse.database || 'default';
  }

  async getOverviewByGuildId(
    guildId: string,
    timezone?: string,
  ): Promise<AnalyticsOverviewDto> {
    const db = this.getDatabase();

    const todayQuery =
      timezone != null && timezone.trim() !== ''
        ? `SELECT toDate(toTimeZone(now(), {tz:String})) AS today`
        : `SELECT toDate(now()) AS today`;
    const todayParams =
      timezone != null && timezone.trim() !== ''
        ? { tz: timezone }
        : {};

    const nowResult = await this.clickhouse.query({
      query: todayQuery,
      query_params: todayParams,
    });
    const nowJson = (await nowResult.json()) as
      | { today: string }[]
      | { data?: { today: string }[] };
    const nowRows = Array.isArray(nowJson)
      ? nowJson
      : (nowJson as { data?: { today: string }[] }).data ?? [];
    const today = (nowRows[0] as { today: string } | undefined)?.today ?? '';

    const totalMessagesResult = await this.clickhouse.query({
      query: `
        SELECT event_date, countIfMerge(messages_count) AS messages
        FROM ${db}.mv_daily_activity
        WHERE guild_id = {guildId:UUID}
          AND event_date >= toDate({today:Date}) - 30
          AND event_date <= {today:Date}
        GROUP BY guild_id, event_date
      `,
      query_params: { guildId, today },
    });
    const totalMessagesRows = (await totalMessagesResult.json()) as {
      messages: string | number;
    }[];
    const totalMessagesArr = Array.isArray(totalMessagesRows)
      ? totalMessagesRows
      : (totalMessagesRows as unknown as { data?: { messages: string | number }[] })
          .data ?? [];
    const totalMessages = totalMessagesArr.reduce(
      (acc, row) => acc + Number(row.messages ?? 0),
      0,
    );

    const active24hResult = await this.clickhouse.query({
      query: `
        SELECT uniqCombinedMerge(unique_users_count) AS cnt
        FROM ${db}.mv_daily_activity
        WHERE guild_id = {guildId:UUID} AND event_date = {today:Date}
        GROUP BY guild_id
      `,
      query_params: { guildId, today },
    });
    const activeMembers24h = await this.parseSingleNumber(active24hResult, 0);

    const active7dResult = await this.clickhouse.query({
      query: `
        SELECT uniqCombinedMerge(unique_users_count) AS cnt
        FROM ${db}.mv_daily_activity
        WHERE guild_id = {guildId:UUID}
          AND event_date >= toDate({today:Date}) - 7
          AND event_date <= {today:Date}
        GROUP BY guild_id
      `,
      query_params: { guildId, today },
    });
    const activeMembers7d = await this.parseSingleNumber(active7dResult, 0);

    return {
      totalMessages: Number(totalMessages),
      activeMembers24h: Number(activeMembers24h),
      activeMembers7d: Number(activeMembers7d),
    };
  }

  async getActivityChartByGuildId(
    guildId: string,
    from: string,
    to: string,
    _timezone?: string,
  ): Promise<ActivityChartPointDto[]> {
    const db = this.getDatabase();

    const result = await this.clickhouse.query({
      query: `
        SELECT
          event_date AS date,
          countIfMerge(messages_count) AS messages,
          uniqCombinedMerge(unique_users_count) AS members,
          sumMerge(voice_minutes) AS voiceMinutes
        FROM ${db}.mv_daily_activity
        WHERE guild_id = {guildId:UUID}
          AND event_date >= {from:Date}
          AND event_date <= {to:Date}
        GROUP BY guild_id, event_date
        ORDER BY event_date ASC
      `,
      query_params: { guildId, from, to },
    });

    const rows = (await result.json()) as ActivityChartPointDto[];
    const data = Array.isArray(rows)
      ? rows
      : (rows as unknown as { data?: ActivityChartPointDto[] }).data ?? [];
    return (
      data as {
        date: string;
        messages: string | number;
        members: string | number;
        voiceMinutes: string | number;
      }[]
    ).map((row) => ({
      date: String(row.date),
      messages: Number(row.messages ?? 0),
      members: Number(row.members ?? 0),
      voiceMinutes: Number(row.voiceMinutes ?? 0),
    }));
  }

  async getTopMembersByGuildId(
    guildId: string,
    sortBy: 'messages' | 'voice',
    limit: number,
  ): Promise<TopMemberDto[]> {
    const db = this.getDatabase();

    const orderBy =
      sortBy === 'voice'
        ? 'sum(voice_minutes) DESC, sum(message_count) DESC'
        : 'sum(message_count) DESC, sum(voice_minutes) DESC';

    const result = await this.clickhouse.query({
      query: `
        SELECT
          user_id AS id,
          sum(message_count) AS messages,
          sum(voice_minutes) AS voiceMinutes
        FROM ${db}.mv_top_members
        WHERE guild_id = {guildId:UUID}
        GROUP BY guild_id, user_id
        ORDER BY ${orderBy}
        LIMIT {limit:UInt32}
      `,
      query_params: { guildId, limit },
    });

    const rows = (await result.json()) as {
      id: string;
      messages: string | number;
      voiceMinutes: string | number;
    }[];
    const data = Array.isArray(rows)
      ? rows
      : (rows as unknown as { data?: typeof rows }).data ?? [];
    return data.map((row) => ({
      id: row.id ?? '',
      username: 'Anonymous',
      discriminator: '',
      avatar: '',
      messages: Number(row.messages ?? 0),
      voiceMinutes: Number(row.voiceMinutes ?? 0),
    }));
  }

  private async parseSingleNumber(
    result: Awaited<ReturnType<ClickHouseService['query']>>,
    defaultValue: number,
  ): Promise<number> {
    const j = (await result.json()) as
      | { total?: number; cnt?: number }[]
      | { data?: { total?: number; cnt?: number }[] };
    const arr = Array.isArray(j)
      ? j
      : (j as { data?: { total?: number; cnt?: number }[] }).data ?? [];
    const row = arr[0] as { total?: number; cnt?: number } | undefined;
    const val = row?.total ?? row?.cnt ?? defaultValue;
    return Number(val);
  }
}
