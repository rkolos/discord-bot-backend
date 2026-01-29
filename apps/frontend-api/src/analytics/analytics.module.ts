import { Module } from '@nestjs/common';
import { ClickHouseModule } from '@app/shared';
import { GuildsModule } from '../guilds/guilds.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [ClickHouseModule.forRootAsync(), GuildsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
