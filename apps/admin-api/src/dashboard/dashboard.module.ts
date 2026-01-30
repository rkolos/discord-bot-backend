import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, Guild, Counter } from '@app/shared';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { StatsModule } from '../stats/stats.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Guild, Counter]),
    StatsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
