import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { GuildSyncModule } from './guild-sync.module';
import { MultiTokenModule } from '../multi-token/multi-token.module';
import { GuildReconciliationService } from './guild-reconciliation.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HttpModule.register({ timeout: 15_000 }),
    GuildSyncModule,
    MultiTokenModule,
  ],
  providers: [GuildReconciliationService],
})
export class GuildReconciliationModule {}
