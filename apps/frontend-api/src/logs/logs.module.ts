import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuildLogSetting } from '@app/shared';
import { GuildsModule } from '../guilds/guilds.module';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { LogsQueueService } from './logs-queue.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GuildLogSetting]),
    GuildsModule,
  ],
  controllers: [LogsController],
  providers: [LogsService, LogsQueueService],
  exports: [LogsService],
})
export class LogsModule {}
