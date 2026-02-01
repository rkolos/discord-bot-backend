import { Module } from '@nestjs/common';
import { GuildSetupQueueProducerModule } from '../guild-setup-queue-producer/guild-setup-queue-producer.module';
import { GuildSyncService } from './guild-sync.service';

@Module({
  imports: [GuildSetupQueueProducerModule],
  providers: [GuildSyncService],
  exports: [GuildSyncService],
})
export class GuildSyncModule {}
