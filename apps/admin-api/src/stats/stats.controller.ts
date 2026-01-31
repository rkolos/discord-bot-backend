import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { GrowthQueryDto } from './dto/growth-query.dto';

@ApiTags('Stats')
@ApiBearerAuth()
@Controller('admin/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('growth')
  @ApiOperation({
    summary: 'Growth stats',
    description: 'Returns time series of total guilds and users. Query: from, to. Admin JWT.',
  })
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
