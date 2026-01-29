import { ClickHouseModule, RedisModule, SharedConfigModule } from '@app/shared';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    SharedConfigModule,
    RedisModule.forRootAsync(),
    ClickHouseModule.forRootAsync(),
  ],
})
export class AppModule {}
