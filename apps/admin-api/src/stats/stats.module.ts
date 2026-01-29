import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Guild, User } from '@app/shared';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [TypeOrmModule.forFeature([Guild, User])],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
