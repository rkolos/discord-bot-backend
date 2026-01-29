import {
  ClickHouseModule,
  DatabaseModule,
  RedisModule,
  SharedConfigModule,
} from '@app/shared';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    SharedConfigModule,
    DatabaseModule,
    RedisModule.forRootAsync(),
    ClickHouseModule.forRootAsync(),
  ],
})
export class AppModule {}
