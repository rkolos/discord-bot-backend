import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GuildAdminGuard } from '../guilds/guards/guild-admin.guard';
import { GuildIdParamDto } from '../guilds/dto/guild-id-param.dto';
import { AnalyticsService } from './analytics.service';
import {
  ActivityChartQueryDto,
  TopMembersQueryDto,
  AnalyticsQueryDto,
} from './dto';

@Controller('guilds/:guildId/analytics')
@UseGuards(JwtAuthGuard, GuildAdminGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  async getCombinedAnalytics(
    @Param() params: GuildIdParamDto,
    @Query() query: AnalyticsQueryDto,
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
    );
    return { data };
  }

  @Get('overview')
  async getOverview(
    @Param() params: GuildIdParamDto,
  ): Promise<{
    data: {
      totalMessages: number;
      activeMembers24h: number;
      activeMembers7d: number;
    };
  }> {
    const data = await this.analyticsService.getOverview(params.guildId);
    return { data };
  }

  @Get('activity-chart')
  async getActivityChart(
    @Param() params: GuildIdParamDto,
    @Query() query: ActivityChartQueryDto,
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
    );
    return { data };
  }

  @Get('top-members')
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
