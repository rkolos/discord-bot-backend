import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Guild, ServerSettings, CryptoModule } from '@app/shared';
import { HistorySyncConsumer } from './history-sync.consumer';
import { HistorySyncService } from './history-sync.service';
import { GuildSettingsEnrichmentService } from '../guild-settings-enrichment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Guild, ServerSettings]),
    CryptoModule,
  ],
  providers: [GuildSettingsEnrichmentService, HistorySyncService, HistorySyncConsumer],
})
export class HistorySyncModule {}
