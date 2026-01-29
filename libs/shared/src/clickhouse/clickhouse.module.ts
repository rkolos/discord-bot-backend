import { DynamicModule, Global, Module } from '@nestjs/common';
import { createClient, type ClickHouseClient } from '@clickhouse/client';
import { SharedConfigModule } from '../config/shared-config.module';
import { SharedConfigService } from '../config/shared-config.service';
import { CLICKHOUSE_CLIENT } from './clickhouse.constants';
import { ClickHouseService } from './clickhouse.service';

@Global()
@Module({})
export class ClickHouseModule {
  static forRootAsync(): DynamicModule {
    return {
      module: ClickHouseModule,
      imports: [SharedConfigModule],
      providers: [
        {
          provide: CLICKHOUSE_CLIENT,
          useFactory: (sharedConfig: SharedConfigService): ClickHouseClient => {
            const { host, port, user, password, database } =
              sharedConfig.clickhouse;
            const url =
              port === 8123
                ? `http://${host}:8123`
                : `http://${host}:${port}`;
            return createClient({
              url,
              username: user,
              password,
              database,
            });
          },
          inject: [SharedConfigService],
        },
        ClickHouseService,
      ],
      exports: [ClickHouseService, CLICKHOUSE_CLIENT],
    };
  }
}
