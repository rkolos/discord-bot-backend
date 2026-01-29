import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Counter } from '@app/shared';
import { GuildsModule } from '../guilds/guilds.module';
import { CountersController } from './counters.controller';
import { CountersService } from './counters.service';
import { CountersQueueService } from './counters-queue.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Counter]),
    GuildsModule,
  ],
  controllers: [CountersController],
  providers: [CountersService, CountersQueueService],
  exports: [CountersService],
})
export class CountersModule {}
