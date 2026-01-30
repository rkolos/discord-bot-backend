import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { SystemService } from './system.service';
import { MaintenanceModeDto } from './dto/maintenance-mode.dto';
import { SystemLogsQueryDto } from './dto/system-logs-query.dto';

@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('health/summary')
  async getHealthSummary(): Promise<{
    data: { api: string; gateway: string; database: string; queues: string };
  }> {
    const data = await this.systemService.getHealthSummary();
    return { data };
  }

  @Get('shards')
  async getShards(): Promise<{
    data: Array<{
      id: number;
      status: string;
      ping: number;
      guildCount: number;
      uptimeSeconds: number;
    }>;
  }> {
    const data = await this.systemService.getShards();
    return { data };
  }

  @Post('shards/:id/restart')
  async restartShard(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ data: { success: boolean } }> {
    await this.systemService.restartShard(id);
    return { data: { success: true } };
  }

  @Post('guilds/:id/sync')
  async syncGuild(
    @Param('id') id: string,
  ): Promise<{ data: { success: boolean; syncedAt: string } }> {
    const result = await this.systemService.syncGuild(id);
    return { data: result };
  }

  @Get('queues')
  async getQueues(): Promise<{
    data: Array<{
      queueName: string;
      active: number;
      waiting: number;
      delayed: number;
      failed: number;
      paused: boolean;
    }>;
  }> {
    const data = await this.systemService.getQueues();
    return { data };
  }

  @Get('queues/stalled')
  async getStalledJobs(
    @Query('queueName') queueName?: string,
  ): Promise<{
    data: Array<{
      jobId: string;
      queueName: string;
      jobName: string;
      timestamp: string;
      attempts: number;
    }>;
  }> {
    const data = await this.systemService.getStalledJobs(queueName);
    return { data };
  }

  @Post('queues/:name/retry-failed')
  async retryFailed(
    @Param('name') name: string,
  ): Promise<{ data: { success: boolean; retriedCount: number } }> {
    const data = await this.systemService.retryFailed(name);
    return { data };
  }

  @Post('maintenance/mode')
  async setMaintenanceMode(
    @Body() dto: MaintenanceModeDto,
  ): Promise<{ data: { maintenanceMode: boolean } }> {
    const data = await this.systemService.setMaintenanceMode(dto.enabled);
    return { data };
  }

  @Post('cleanup/orphans')
  async cleanupOrphans(): Promise<{
    data: {
      success: boolean;
      countersRemoved: number;
      widgetsRemoved: number;
      jobsRemoved: number;
    };
  }> {
    const data = await this.systemService.cleanupOrphans();
    return { data };
  }

  @Get('logs')
  async getLogs(
    @Query() query: SystemLogsQueryDto,
  ): Promise<{
    data: Array<{
      timestamp: string;
      level: string;
      message: string;
      service: string;
    }>;
    meta: { cursor: string; hasMore: boolean };
  }> {
    const result = await this.systemService.getLogs(
      query.limit ?? 50,
      query.cursor,
      query.level,
      query.service,
    );
    return result;
  }
}
