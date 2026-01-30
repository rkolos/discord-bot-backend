import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(AdminAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async getOverview(): Promise<{
    data: {
      activeUsers: { current: number; trend: number };
      totalGuilds: { current: number; trend: number };
      totalCounters: { current: number; trend: number };
      mrr: { current: number; currency: string };
      growthData: Array<{ date: string; value: number }>;
      featureLeaderboard: Array<{
        type: string;
        count: number;
        percentage: number;
        popularTemplate: string;
      }>;
      systemStatus: { api: string; gateway: string; database: string };
    };
  }> {
    const data = await this.dashboardService.getOverview();
    return { data };
  }
}
