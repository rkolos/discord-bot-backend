import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GuildAdminGuard } from '../guilds/guards/guild-admin.guard';
import { GuildIdParamDto } from '../guilds/dto/guild-id-param.dto';
import { AnalyticsService } from './analytics.service';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';

@Controller('guilds')
@UseGuards(JwtAuthGuard, GuildAdminGuard)
export class HeatmapController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get(':guildId/heatmap')
  async getHeatmap(
    @Param() params: GuildIdParamDto,
  ): Promise<{
    data: Array<{ dayOfWeek: number; hour: number; value: number }>;
  }> {
    const data = await this.analyticsService.getHeatmap(params.guildId);
    return { data };
  }

  @Get(':guildId/leaderboard')
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
