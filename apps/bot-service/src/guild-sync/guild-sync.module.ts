import { Module } from '@nestjs/common';
import { GuildSyncService } from './guild-sync.service';

@Module({
  providers: [GuildSyncService],
  exports: [GuildSyncService],
})
export class GuildSyncModule {}
