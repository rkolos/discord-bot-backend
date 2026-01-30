import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('counters')
  async getCounters(
    @Query() query: AnalyticsQueryDto,
  ): Promise<{
    data: {
      distribution: Array<{
        type: string;
        count: number;
        percentage: number;
        popularTemplate: string;
      }>;
      topTemplates: Array<{ template: string; usageCount: number }>;
      totalActive: number;
      avgPerGuild: number;
    };
  }> {
    const data = await this.analyticsService.getCounters(query.from, query.to);
    return { data };
  }

  @Get('widgets')
  async getWidgets(
    @Query() query: AnalyticsQueryDto,
  ): Promise<{
    data: {
      totalViews: number;
      totalClicks: number;
      ctr: number;
      timeSeries: Array<{ date: string; value: number; value2: number }>;
      topReferrers: Array<{ domain: string; views: number; clicks: number }>;
    };
  }> {
    const data = await this.analyticsService.getWidgets(query.from, query.to);
    return { data };
  }

  @Get('growth')
  async getGrowth(
    @Query() query: AnalyticsQueryDto,
  ): Promise<{
    data: {
      sources: Array<{ source: string; installs: number; percentage: number }>;
      leaderboard: Array<{
        userId: string;
        username: string;
        avatarUrl: string;
        invitesCount: number;
        retentionRate?: number;
      }>;
      totalInstalls: number;
    };
  }> {
    const data = await this.analyticsService.getGrowth(query.from, query.to);
    return { data };
  }

  @Get('commands')
  async getCommands(
    @Query() query: AnalyticsQueryDto,
  ): Promise<{
    data: Array<{
      commandName: string;
      category: string;
      executionCount: number;
      errorCount: number;
      errorRate: number;
      avgLatency: number;
    }>;
  }> {
    const data = await this.analyticsService.getCommands(query.from, query.to);
    return { data };
  }

  @Get('leaderboards')
  async getLeaderboards(): Promise<{
    data: Array<{
      id: string;
      name: string;
      iconUrl: string | null;
      memberCount: number;
      ownerName: string;
      plan: string;
    }>;
  }> {
    const data = await this.analyticsService.getLeaderboards();
    return { data };
  }
}
