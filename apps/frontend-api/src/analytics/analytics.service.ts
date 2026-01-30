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
}
