import { Module } from '@nestjs/common';
import { SharedAnalyticsModule } from '@app/shared';
import { GuildsModule } from '../guilds/guilds.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [SharedAnalyticsModule, GuildsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
