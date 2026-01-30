import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuildLogSetting } from '@app/shared';
import { LogsConfigConsumerService } from './logs-config-consumer.service';

@Module({
  imports: [TypeOrmModule.forFeature([GuildLogSetting])],
  providers: [LogsConfigConsumerService],
})
export class LogsConsumerModule {}
