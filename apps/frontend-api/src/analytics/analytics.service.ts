import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClickHouseService } from '@app/shared';
import { SharedConfigService } from '@app/shared';
import { GuildSubscriptionTier } from '@app/shared';
import { GuildsService } from '../guilds/guilds.service';

const FREE_PLAN_MAX_DAYS = 365;

export interface AnalyticsOverviewDto {
  totalMessages: number;
  activeMembers24h: number;
  activeMembers7d: number;
}

export interface ActivityChartPointDto {
  date: string;
  messages: number;
  members: number;
  voiceMinutes: number;
}

export interface TopMemberDto {
  id: string;
  username: string;
  discriminator: string;
  avatar: string;
  messages: number;
  voiceMinutes: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly clickhouse: ClickHouseService,
    private readonly sharedConfig: SharedConfigService,
    private readonly guildsService: GuildsService,
  ) {}

  private getDatabase(): string {
    return this.sharedConfig.clickhouse.database || 'default';
  }

  async getOverview(discordGuildId: string): Promise<AnalyticsOverviewDto> {
    const guild = await this.guildsService.findGuildByDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const db = this.getDatabase();
    const guildId = guild.id;

    const nowResult = await this.clickhouse.query({
      query: `SELECT toDate(now()) AS today`,
      query_params: {},
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
    const totalMessagesRows = (await totalMessagesResult.json()) as { messages: string | number }[];
    const totalMessagesArr = Array.isArray(totalMessagesRows)
      ? totalMessagesRows
      : (totalMessagesRows as unknown as { data?: { messages: string | number }[] }).data ?? [];
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

  async getActivityChart(
    discordGuildId: string,
    from: string,
    to: string,
    _period?: 'day' | 'week' | 'month',
  ): Promise<ActivityChartPointDto[]> {
    const guild = await this.guildsService.findGuildByDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    this.validateDateRange(from, to);
    this.validateFreePlanPeriod(guild.subscriptionTier, from, to);

    const db = this.getDatabase();
    const guildId = guild.id;

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
    const data = Array.isArray(rows) ? rows : (rows as unknown as { data?: ActivityChartPointDto[] }).data ?? [];
    return (data as { date: string; messages: string | number; members: string | number; voiceMinutes: string | number }[]).map((row) => ({
      date: String(row.date),
      messages: Number(row.messages ?? 0),
      members: Number(row.members ?? 0),
      voiceMinutes: Number(row.voiceMinutes ?? 0),
    }));
  }

  async getTopMembers(
    discordGuildId: string,
    sortBy: 'messages' | 'voice',
    limit: number,
  ): Promise<TopMemberDto[]> {
    const guild = await this.guildsService.findGuildByDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const db = this.getDatabase();
    const guildId = guild.id;

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

    const rows = (await result.json()) as { id: string; messages: string | number; voiceMinutes: string | number }[];
    const data = Array.isArray(rows) ? rows : (rows as unknown as { data?: typeof rows }).data ?? [];
    return data.map((row) => ({
      id: row.id ?? '',
      username: 'Anonymous',
      discriminator: '',
      avatar: '',
      messages: Number(row.messages ?? 0),
      voiceMinutes: Number(row.voiceMinutes ?? 0),
    }));
  }

  validateDateRange(from: string, to: string): void {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: "Invalid date range. Use ISO 8601 date format (YYYY-MM-DD)",
      });
    }
    if (fromDate > toDate) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: "Invalid date range. 'from' must be before 'to'",
      });
    }
  }

  validateFreePlanPeriod(
    subscriptionTier: GuildSubscriptionTier,
    from: string,
    to: string,
  ): void {
    if (subscriptionTier !== GuildSubscriptionTier.FREE) return;
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const days = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    if (days > FREE_PLAN_MAX_DAYS) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: `Free plan allows analytics for up to ${FREE_PLAN_MAX_DAYS} days. Requested period exceeds this limit.`,
      });
    }
  }

  private async parseSingleNumber(
    result: Awaited<ReturnType<ClickHouseService['query']>>,
    defaultValue: number,
  ): Promise<number> {
    const j = (await result.json()) as { total?: number; cnt?: number }[] | { data?: { total?: number; cnt?: number }[] };
    const arr = Array.isArray(j) ? j : (j as { data?: { total?: number; cnt?: number }[] }).data ?? [];
    const row = arr[0] as { total?: number; cnt?: number } | undefined;
    const val = row?.total ?? row?.cnt ?? defaultValue;
    return Number(val);
  }
}
