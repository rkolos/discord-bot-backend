import { Module, forwardRef } from '@nestjs/common';
import { GuildSetupQueueProducerModule } from '../guild-setup-queue-producer/guild-setup-queue-producer.module';
import { InternalModule } from '../internal/internal.module';
import { GuildSyncService } from './guild-sync.service';

@Module({
  imports: [
    GuildSetupQueueProducerModule,
    forwardRef(() => InternalModule),
  ],
  providers: [GuildSyncService],
  exports: [GuildSyncService],
})
export class GuildSyncModule {}
