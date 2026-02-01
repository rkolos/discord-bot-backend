import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Guild, ServerSettings } from '@app/shared';
import { GuildSyncModule } from './guild-sync.module';
import { InternalModule } from '../internal/internal.module';
import { MultiTokenModule } from '../multi-token/multi-token.module';
import { GuildReconciliationService } from './guild-reconciliation.service';
import { GuildSyncSchedulerService } from './guild-sync-scheduler.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HttpModule.register({ timeout: 15_000 }),
    TypeOrmModule.forFeature([Guild, ServerSettings]),
    GuildSyncModule,
    forwardRef(() => InternalModule),
    MultiTokenModule,
  ],
  providers: [GuildReconciliationService, GuildSyncSchedulerService],
})
export class GuildReconciliationModule {}
