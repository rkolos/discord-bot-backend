import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  getAnalyticsMaxDaysForTier,
  SharedAnalyticsService,
  type ActivityChartPointDto,
  type AnalyticsOverviewDto,
  type TopMemberDto,
} from '@app/shared';
import { GuildsService } from '../guilds/guilds.service';

export type { AnalyticsOverviewDto, ActivityChartPointDto, TopMemberDto };

export interface AnalyticsTimezoneOptions {
  headerTimezone?: string;
  queryTimezone?: string;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly sharedAnalytics: SharedAnalyticsService,
    private readonly guildsService: GuildsService,
  ) {}

  private async resolveTimezone(
    discordGuildId: string,
    options?: AnalyticsTimezoneOptions,
  ): Promise<string> {
    const tz = options?.headerTimezone ?? options?.queryTimezone;
    if (tz != null && String(tz).trim() !== '') {
      return tz;
    }
    const settings = await this.guildsService.getSettings(discordGuildId);
    return settings.timezone ?? 'UTC';
  }

  async getOverview(
    discordGuildId: string,
    timezoneOptions?: AnalyticsTimezoneOptions,
  ): Promise<AnalyticsOverviewDto> {
    const guild = await this.guildsService.findGuildByIdOrDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const timezone = await this.resolveTimezone(discordGuildId, timezoneOptions);
    return this.sharedAnalytics.getOverviewByGuildId(guild.id, timezone);
  }

  async getActivityChart(
    discordGuildId: string,
    from: string,
    to: string,
    _period?: 'day' | 'week' | 'month',
    timezoneOptions?: AnalyticsTimezoneOptions,
  ): Promise<ActivityChartPointDto[]> {
    const guild = await this.guildsService.findGuildByIdOrDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    this.validateDateRange(from, to);
    this.validatePlanPeriod(guild.subscriptionTier, from, to);
    const timezone = await this.resolveTimezone(discordGuildId, timezoneOptions);
    return this.sharedAnalytics.getActivityChartByGuildId(
      guild.id,
      from,
      to,
      timezone,
    );
  }

  async getTopMembers(
    discordGuildId: string,
    sortBy: 'messages' | 'voice',
    limit: number,
  ): Promise<TopMemberDto[]> {
    const guild = await this.guildsService.findGuildByIdOrDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const settings = await this.guildsService.getSettings(discordGuildId);
    return this.sharedAnalytics.getTopMembersByGuildId(guild.id, sortBy, limit, {
      anonymizeUserData: settings.anonymizeUserData,
    });
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

  validatePlanPeriod(
    subscriptionTier: string,
    from: string,
    to: string,
  ): void {
    const maxDays = getAnalyticsMaxDaysForTier(subscriptionTier);
    if (maxDays === null) return;
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const days = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    if (days > maxDays) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: `Your plan allows analytics for up to ${maxDays} days. Requested period exceeds this limit.`,
      });
    }
  }

  async getCombinedAnalytics(
    discordGuildId: string,
    from: string,
    to: string,
    timezoneOptions?: AnalyticsTimezoneOptions,
  ): Promise<{
    timeSeries: ActivityChartPointDto[];
    heatmap: Array<{ dayOfWeek: number; hour: number; value: number }>;
    summary: {
      totalMessages: number;
      totalMembers: number;
      totalVoiceMinutes: number;
      averageMessagesPerDay: number;
      averageMembersPerDay: number;
    };
    topChannels: {
      messages: Array<{ id: string; name: string; type: string; value: number }>;
      voice: Array<{ id: string; name: string; type: string; value: number }>;
    };
    topMembers: TopMemberDto[];
    roleDistribution: Array<{ id: string; name: string; color: string; count: number }>;
    topCommands: Array<{
      id: string;
      name: string;
      usageCount: number;
      lastUsedAt: string;
      category: string;
    }>;
  }> {
    const guild = await this.guildsService.findGuildByIdOrDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    this.validateDateRange(from, to);
    this.validatePlanPeriod(guild.subscriptionTier, from, to);
    const timezone = await this.resolveTimezone(discordGuildId, timezoneOptions);
    const settings = await this.guildsService.getSettings(discordGuildId);
    const [
      timeSeries,
      topMembers,
      topCommands,
      topChannelsMessages,
      topChannelsVoice,
      roleDistribution,
      channelsMap,
      rolesMap,
      _overview,
    ] = await Promise.all([
      this.sharedAnalytics.getActivityChartByGuildId(
        guild.id,
        from,
        to,
        timezone,
      ),
      this.sharedAnalytics.getTopMembersByGuildId(guild.id, 'messages', 20, {
        anonymizeUserData: settings.anonymizeUserData,
      }),
      this.sharedAnalytics.getTopCommandsByGuildId(guild.id, from, to, 10),
      this.sharedAnalytics.getTopChannelsByMessages(guild.id, from, to, 10),
      this.sharedAnalytics.getTopChannelsByVoice(guild.id, from, to, 10),
      this.sharedAnalytics.getRoleDistributionByGuildId(guild.id, from, to),
      this.guildsService.getChannelsWithTypeForGuild(discordGuildId),
      this.guildsService.getRolesForGuild(discordGuildId),
      this.sharedAnalytics.getOverviewByGuildId(guild.id, timezone),
    ]);
    const heatmap = await this.getHeatmap(discordGuildId);
    const totalMessages = timeSeries.reduce((acc, p) => acc + p.messages, 0);
    const totalMembers = timeSeries.reduce((acc, p) => acc + p.members, 0);
    const totalVoiceMinutes = timeSeries.reduce((acc, p) => acc + p.voiceMinutes, 0);
    const days = timeSeries.length || 1;
    return {
      timeSeries,
      heatmap,
      summary: {
        totalMessages,
        totalMembers,
        totalVoiceMinutes,
        averageMessagesPerDay: totalMessages / days,
        averageMembersPerDay: totalMembers / days,
      },
      topChannels: {
        messages: topChannelsMessages.map((ch) => {
          const meta = channelsMap.find((c) => c.id === ch.id);
          return {
            id: ch.id,
            name: meta?.name ?? ch.id,
            type: meta?.type ?? 'text',
            value: ch.value,
          };
        }),
        voice: topChannelsVoice.map((ch) => {
          const meta = channelsMap.find((c) => c.id === ch.id);
          return {
            id: ch.id,
            name: meta?.name ?? ch.id,
            type: meta?.type ?? 'voice',
            value: ch.value,
          };
        }),
      },
      topMembers,
      roleDistribution: roleDistribution.map((r) => {
        const meta = rolesMap.find((m) => m.id === r.id);
        return {
          id: r.id,
          name: meta?.name ?? r.id,
          color: meta?.color ?? '',
          count: r.count,
        };
      }),
      topCommands,
    };
  }

  async getHeatmap(
    discordGuildId: string,
  ): Promise<Array<{ dayOfWeek: number; hour: number; value: number }>> {
    const guild = await this.guildsService.findGuildByIdOrDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    return this.sharedAnalytics.getHeatmapByGuildId(guild.id);
  }

  async getLeaderboard(
    discordGuildId: string,
    sortBy: 'messages' | 'voice' | 'rank',
    sortOrder: 'asc' | 'desc',
    page: number,
    pageSize: number,
  ): Promise<{
    entries: Array<{
      rank: number;
      userId: string;
      username: string;
      avatar: string;
      messages: number;
      voiceMinutes: number;
    }>;
    pagination: { page: number; pageSize: number; total: number };
  }> {
    const guild = await this.guildsService.findGuildByIdOrDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const limit = Math.min(100, Math.max(1, pageSize));
    const sortByMetric = sortBy === 'rank' ? 'messages' : sortBy;
    const settings = await this.guildsService.getSettings(discordGuildId);
    const topMembers = await this.sharedAnalytics.getTopMembersByGuildId(
      guild.id,
      sortByMetric,
      500,
      { anonymizeUserData: settings.anonymizeUserData },
    );
    const ordered =
      sortOrder === 'asc'
        ? [...topMembers].reverse()
        : topMembers;
    const total = ordered.length;
    const skip = (Math.max(1, page) - 1) * limit;
    const slice = ordered.slice(skip, skip + limit);
    const entries = slice.map((m, i) => ({
      rank: skip + i + 1,
      userId: m.id,
      username: m.username,
      avatar: m.avatar,
      messages: m.messages,
      voiceMinutes: m.voiceMinutes,
    }));
    return {
      entries,
      pagination: { page: Math.max(1, page), pageSize: limit, total },
    };
  }

  async getEventsTimeSeries(
    discordGuildId: string,
    from: string,
    to: string,
    groupBy: 'day' | 'week' | 'month',
    eventTypes: string[] | undefined,
    timezoneOptions?: AnalyticsTimezoneOptions,
  ): Promise<Array<{ date: string; eventType: string; count: number }>> {
    const guild = await this.guildsService.findGuildByIdOrDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    this.validateDateRange(from, to);
    this.validatePlanPeriod(guild.subscriptionTier, from, to);
    const timezone = await this.resolveTimezone(discordGuildId, timezoneOptions);
    return this.sharedAnalytics.getEventsTimeSeriesByGuildId(
      guild.id,
      from,
      to,
      groupBy ?? 'day',
      eventTypes,
      timezone,
    );
  }

  async getEventsSearch(
    discordGuildId: string,
    from: string,
    to: string,
    options: {
      eventTypes?: string[];
      channelId?: string;
      limit: number;
      cursor?: { eventId: string; eventTime: string };
    },
  ): Promise<{
    data: Array<{
      eventId: string;
      eventTime: string;
      eventType: string;
      channelId: string | null;
      channelName: string | null;
      payloadSummary?: Record<string, unknown>;
    }>;
    nextCursor?: { eventId: string; eventTime: string };
  }> {
    const guild = await this.guildsService.findGuildByIdOrDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    this.validateDateRange(from, to);
    this.validatePlanPeriod(guild.subscriptionTier, from, to);
    const [result, channels] = await Promise.all([
      this.sharedAnalytics.getEventsByGuildId(guild.id, from, to, options),
      this.guildsService.getChannelsWithTypeForGuild(discordGuildId),
    ]);
    const channelNameMap = new Map(channels.map((c) => [c.id, c.name]));
    return {
      ...result,
      data: result.data.map((e) => ({
        ...e,
        channelName:
          e.channelId != null ? (channelNameMap.get(e.channelId) ?? null) : null,
      })),
    };
  }
}
