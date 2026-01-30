import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { RedisService } from '@app/shared';
import { ShardingManagerService } from '../sharding/sharding-manager.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let shardingManager: jest.Mocked<Pick<ShardingManagerService, 'isGatewayReady'>>;

  beforeEach(async () => {
    const mockHealth = {
      check: jest.fn().mockImplementation((checks: (() => Promise<unknown>)[]) => {
        return Promise.all(checks.map((c) => c())).then((results) => ({
          status: 'ok',
          info: Object.fromEntries(
            results.map((r, i) => [`check_${i}`, (r as Record<string, unknown>) ?? {}]),
          ),
          details: Object.assign({}, ...(results as Record<string, unknown>[])),
        }));
      }),
    };
    const mockDb = { pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }) };
    const mockRedis = {
      getClient: jest.fn().mockReturnValue({ ping: jest.fn().mockResolvedValue('PONG') }),
    };
    shardingManager = { isGatewayReady: jest.fn().mockReturnValue(false) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealth },
        { provide: TypeOrmHealthIndicator, useValue: mockDb },
        { provide: RedisService, useValue: mockRedis },
        { provide: ShardingManagerService, useValue: shardingManager },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('check includes gateway status', async () => {
    (shardingManager.isGatewayReady as jest.Mock).mockReturnValue(true);

    const result = await controller.check();

    expect(result).toBeDefined();
    expect(result.details).toBeDefined();
    expect((result.details as Record<string, unknown>).gateway).toEqual({
      status: 'up',
      ready: true,
    });
  });

  it('gateway is down when no shard ready', async () => {
    (shardingManager.isGatewayReady as jest.Mock).mockReturnValue(false);

    const result = await controller.check();

    expect((result.details as Record<string, unknown>).gateway).toEqual({
      status: 'down',
      ready: false,
    });
  });
});
