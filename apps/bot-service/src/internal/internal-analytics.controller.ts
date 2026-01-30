import { Controller, Get, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { SharedAnalyticsService } from '@app/shared';
import { InternalApiGuard } from './internal-api.guard';

@Controller('internal/analytics')
@UseGuards(InternalApiGuard)
export class InternalAnalyticsController {
  constructor(private readonly sharedAnalytics: SharedAnalyticsService) {}

  @Get('overview')
  async getOverview(
    @Query('guildId', ParseUUIDPipe) guildId: string,
  ): Promise<{
    totalMessages: number;
    activeMembers24h: number;
    activeMembers7d: number;
  }> {
    return this.sharedAnalytics.getOverviewByGuildId(guildId);
  }
}
