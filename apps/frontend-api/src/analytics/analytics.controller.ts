import { Controller, Get, Headers, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GuildAdminGuard } from '../guilds/guards/guild-admin.guard';
import { GuildIdParamDto } from '../guilds/dto/guild-id-param.dto';
import { AnalyticsService } from './analytics.service';
import {
  ActivityChartQueryDto,
  OverviewQueryDto,
  TopMembersQueryDto,
  AnalyticsQueryDto,
} from './dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('guilds/:guildId/analytics')
@UseGuards(JwtAuthGuard, GuildAdminGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get combined analytics',
    description:
      'Returns time series, heatmap, summary, top channels, top members, role distribution, top commands for the guild. Query: from, to, timezone. Bearer JWT, guild admin.',
  })
  async getCombinedAnalytics(
    @Param() params: GuildIdParamDto,
    @Query() query: AnalyticsQueryDto,
    @Headers('x-timezone') xTimezone?: string,
  ): Promise<{
    data: {
      timeSeries: Array<{
        date: string;
        messages: number;
        members: number;
        voiceMinutes: number;
      }>;
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
      topMembers: Array<{
        id: string;
        username: string;
        discriminator: string;
        avatar: string;
        messages: number;
        voiceMinutes: number;
      }>;
      roleDistribution: Array<{
        id: string;
        name: string;
        color: string;
        count: number;
      }>;
      topCommands: Array<{
        id: string;
        name: string;
        usageCount: number;
        lastUsedAt: string;
        category: string;
      }>;
    };
  }> {
    const data = await this.analyticsService.getCombinedAnalytics(
      params.guildId,
      query.from,
      query.to,
      { headerTimezone: xTimezone, queryTimezone: query.timezone },
    );
    return { data };
  }

  @Get('overview')
  @ApiOperation({
    summary: 'Get analytics overview',
    description:
      'Returns total messages, active members (24h, 7d). Bearer JWT, guild admin.',
  })
  async getOverview(
    @Param() params: GuildIdParamDto,
    @Query() query: OverviewQueryDto,
    @Headers('x-timezone') xTimezone?: string,
  ): Promise<{
    data: {
      totalMessages: number;
      activeMembers24h: number;
      activeMembers7d: number;
    };
  }> {
    const data = await this.analyticsService.getOverview(params.guildId, {
      headerTimezone: xTimezone,
      queryTimezone: query.timezone,
    });
    return { data };
  }

  @Get('activity-chart')
  @ApiOperation({
    summary: 'Get activity chart data',
    description:
      'Returns time-series data for activity chart (date, messages, members, voiceMinutes). Query: from, to, period, timezone. Bearer JWT, guild admin.',
  })
  async getActivityChart(
    @Param() params: GuildIdParamDto,
    @Query() query: ActivityChartQueryDto,
    @Headers('x-timezone') xTimezone?: string,
  ): Promise<{
    data: Array<{
      date: string;
      messages: number;
      members: number;
      voiceMinutes: number;
    }>;
  }> {
    const data = await this.analyticsService.getActivityChart(
      params.guildId,
      query.from,
      query.to,
      query.period,
      { headerTimezone: xTimezone, queryTimezone: query.timezone },
    );
    return { data };
  }

  @Get('top-members')
  @ApiOperation({
    summary: 'Get top members',
    description:
      'Returns top members by messages or voice minutes. Query: sortBy, limit. Bearer JWT, guild admin.',
  })
  async getTopMembers(
    @Param() params: GuildIdParamDto,
    @Query() query: TopMembersQueryDto,
  ): Promise<{
    data: Array<{
      id: string;
      username: string;
      discriminator: string;
      avatar: string;
      messages: number;
      voiceMinutes: number;
    }>;
  }> {
    const data = await this.analyticsService.getTopMembers(
      params.guildId,
      query.sortBy ?? 'messages',
      query.limit ?? 10,
    );
    return { data };
  }
}
