import { Module } from '@nestjs/common';
import { GuildSetupQueueProducerService } from './guild-setup-queue-producer.service';

@Module({
  providers: [GuildSetupQueueProducerService],
  exports: [GuildSetupQueueProducerService],
})
export class GuildSetupQueueProducerModule {}
