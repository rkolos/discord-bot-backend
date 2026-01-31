import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('counters')
  @ApiOperation({
    summary: 'Counters analytics',
    description: 'Returns counter distribution, top templates, total active, avg per guild. Query: from, to. Admin JWT.',
  })
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
  @ApiOperation({
    summary: 'Widgets analytics',
    description: 'Returns total views/clicks, CTR, time series, top referrers. Query: from, to. Admin JWT.',
  })
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
  @ApiOperation({
    summary: 'Growth analytics',
    description: 'Returns install sources, leaderboard, total installs. Query: from, to. Admin JWT.',
  })
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
  @ApiOperation({
    summary: 'Commands analytics',
    description: 'Returns command usage, errors, latency. Query: from, to. Admin JWT.',
  })
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
  @ApiOperation({
    summary: 'Leaderboards list',
    description: 'Returns list of guild leaderboards (id, name, memberCount, plan). Admin JWT.',
  })
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
