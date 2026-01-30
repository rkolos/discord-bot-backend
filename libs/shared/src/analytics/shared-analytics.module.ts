import { Module } from '@nestjs/common';
import { ClickHouseModule } from '../clickhouse/clickhouse.module';
import { SharedConfigModule } from '../config/shared-config.module';
import { SharedAnalyticsService } from './shared-analytics.service';

@Module({
  imports: [ClickHouseModule.forRootAsync(), SharedConfigModule],
  providers: [SharedAnalyticsService],
  exports: [SharedAnalyticsService],
})
export class SharedAnalyticsModule {}
