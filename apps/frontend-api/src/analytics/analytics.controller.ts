import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GuildAdminGuard } from '../guilds/guards/guild-admin.guard';
import { GuildIdParamDto } from '../guilds/dto/guild-id-param.dto';
import { AnalyticsService } from './analytics.service';
import { ActivityChartQueryDto, TopMembersQueryDto } from './dto';

@Controller('guilds/:guildId/analytics')
@UseGuards(JwtAuthGuard, GuildAdminGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

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
