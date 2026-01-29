import { Controller, Get, Query } from '@nestjs/common';
import { StatsService } from './stats.service';
import { GrowthQueryDto } from './dto/growth-query.dto';

@Controller('admin/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('growth')
  async getGrowth(
    @Query() query: GrowthQueryDto,
  ): Promise<{
    data: {
      timeSeries: Array<{
        date: string;
        totalGuilds: number;
        totalUsers: number;
      }>;
    };
  }> {
    const timeSeries = await this.statsService.getGrowth(query.from, query.to);
    return { data: { timeSeries } };
  }
}
