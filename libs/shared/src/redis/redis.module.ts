import { DynamicModule, Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { SharedConfigModule } from '../config/shared-config.module';
import { SharedConfigService } from '../config/shared-config.service';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

@Global()
@Module({})
export class RedisModule {
  static forRootAsync(): DynamicModule {
    return {
      module: RedisModule,
      imports: [SharedConfigModule],
      providers: [
        {
          provide: REDIS_CLIENT,
          useFactory: (sharedConfig: SharedConfigService): Redis => {
            const { host, port, password, prefix } = sharedConfig.redis;
            return new Redis({
              host,
              port,
              password: password ?? undefined,
              keyPrefix: prefix,
              retryStrategy(times: number): number {
                return Math.min(times * 100, 3000);
              },
            });
          },
          inject: [SharedConfigService],
        },
        RedisService,
      ],
      exports: [RedisService, REDIS_CLIENT],
    };
  }
}
