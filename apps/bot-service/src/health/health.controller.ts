import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  HealthCheck,
  type HealthCheckResult,
  type HealthIndicatorResult,
} from '@nestjs/terminus';
import { RedisService } from '@app/shared';
import { ShardingManagerService } from '../sharding/sharding-manager.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisService,
    private readonly shardingManager: ShardingManagerService,
  ) {}

  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 3000 }),
      () => this.pingRedis(),
      () => this.checkGateway(),
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

  private async checkGateway(): Promise<HealthIndicatorResult> {
    const ready = this.shardingManager.isGatewayReady();
    return {
      gateway: {
        status: ready ? 'up' : 'down',
        ready: ready,
      },
    };
  }
}
