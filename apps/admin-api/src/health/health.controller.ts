import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  HealthCheck,
  type HealthCheckResult,
  type HealthIndicatorResult,
} from '@nestjs/terminus';
import { RedisService, ClickHouseService } from '@app/shared';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisService,
    private readonly clickhouse: ClickHouseService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Health check',
    description: 'Checks database, Redis, ClickHouse. No auth. Public.',
  })
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 3000 }),
      () => this.pingRedis(),
      () => this.pingClickHouse(),
    ]);
  }

  private async pingRedis(): Promise<HealthIndicatorResult> {
    try {
      const client = this.redis.getClient();
      await client.ping();
      return { redis: { status: 'up' } };
    } catch (err) {
      throw new Error(`Redis ping failed: ${(err as Error).message}`);
    }
  }

  private async pingClickHouse(): Promise<HealthIndicatorResult> {
    try {
      await this.clickhouse.query({
        query: 'SELECT 1 AS n',
        query_params: {},
      });
      return { clickhouse: { status: 'up' } };
    } catch (err) {
      throw new Error(`ClickHouse ping failed: ${(err as Error).message}`);
    }
  }
}
