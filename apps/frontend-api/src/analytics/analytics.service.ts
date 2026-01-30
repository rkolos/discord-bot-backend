import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GuildSubscriptionTier,
  SharedAnalyticsService,
  type ActivityChartPointDto,
  type AnalyticsOverviewDto,
  type TopMemberDto,
} from '@app/shared';
import { GuildsService } from '../guilds/guilds.service';

const FREE_PLAN_MAX_DAYS = 365;

export type { AnalyticsOverviewDto, ActivityChartPointDto, TopMemberDto };

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly sharedAnalytics: SharedAnalyticsService,
    private readonly guildsService: GuildsService,
  ) {}

  async getOverview(discordGuildId: string): Promise<AnalyticsOverviewDto> {
    const guild = await this.guildsService.findGuildByDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    return this.sharedAnalytics.getOverviewByGuildId(guild.id);
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
    return this.sharedAnalytics.getActivityChartByGuildId(guild.id, from, to);
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
    return this.sharedAnalytics.getTopMembersByGuildId(guild.id, sortBy, limit);
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

  async getCombinedAnalytics(
    discordGuildId: string,
    from: string,
    to: string,
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
    const guild = await this.guildsService.findGuildByDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    this.validateDateRange(from, to);
    this.validateFreePlanPeriod(guild.subscriptionTier, from, to);
    const [timeSeries, topMembers, _overview] = await Promise.all([
      this.sharedAnalytics.getActivityChartByGuildId(guild.id, from, to),
      this.sharedAnalytics.getTopMembersByGuildId(guild.id, 'messages', 20),
      this.sharedAnalytics.getOverviewByGuildId(guild.id),
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
      topChannels: { messages: [], voice: [] },
      topMembers,
      roleDistribution: [],
      topCommands: [],
    };
  }

  async getHeatmap(
    discordGuildId: string,
  ): Promise<Array<{ dayOfWeek: number; hour: number; value: number }>> {
    const guild = await this.guildsService.findGuildByDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const result: Array<{ dayOfWeek: number; hour: number; value: number }> = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        result.push({ dayOfWeek: d, hour: h, value: 0 });
      }
    }
    return result;
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
    const guild = await this.guildsService.findGuildByDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const limit = Math.min(100, Math.max(1, pageSize));
    const sortByMetric = sortBy === 'rank' ? 'messages' : sortBy;
    const topMembers = await this.sharedAnalytics.getTopMembersByGuildId(
      guild.id,
      sortByMetric,
      500,
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
}
