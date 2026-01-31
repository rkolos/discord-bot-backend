import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GuildAdminGuard } from '../guilds/guards/guild-admin.guard';
import { GuildIdParamDto } from '../guilds/dto/guild-id-param.dto';
import { AnalyticsService } from './analytics.service';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('guilds')
@UseGuards(JwtAuthGuard, GuildAdminGuard)
export class HeatmapController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get(':guildId/heatmap')
  @ApiOperation({
    summary: 'Get activity heatmap',
    description:
      'Returns heatmap data (dayOfWeek, hour, value) for activity visualization. Bearer JWT, guild admin.',
  })
  async getHeatmap(
    @Param() params: GuildIdParamDto,
  ): Promise<{
    data: Array<{ dayOfWeek: number; hour: number; value: number }>;
  }> {
    const data = await this.analyticsService.getHeatmap(params.guildId);
    return { data };
  }

  @Get(':guildId/leaderboard')
  @ApiOperation({
    summary: 'Get leaderboard',
    description:
      'Returns paginated leaderboard (rank, userId, username, messages, voiceMinutes). Query: sortBy, sortOrder, page, pageSize. Bearer JWT, guild admin.',
  })
  async getLeaderboard(
    @Param() params: GuildIdParamDto,
    @Query() query: LeaderboardQueryDto,
  ): Promise<{
    data: {
      entries: Array<{
        rank: number;
        userId: string;
        username: string;
        avatar: string;
        messages: number;
        voiceMinutes: number;
      }>;
      pagination: { page: number; pageSize: number; total: number };
    };
  }> {
    const data = await this.analyticsService.getLeaderboard(
      params.guildId,
      query.sortBy ?? 'rank',
      query.sortOrder ?? 'desc',
      query.page ?? 1,
      query.pageSize ?? 20,
    );
    return { data };
  }
}
