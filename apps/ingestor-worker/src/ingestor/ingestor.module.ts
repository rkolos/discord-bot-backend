import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ClickHouseModule,
  DatabaseModule,
  Guild,
  RedisModule,
  ServerSettings,
  SharedConfigModule,
} from '@app/shared';
import { ClickHouseIngestorService } from './clickhouse-ingestor.service';
import { VoiceSessionService } from './voice-session.service';
import { IngestorQueueConsumer } from './ingestor-queue.consumer';
import { GuildSettingsEnrichmentService } from './guild-settings-enrichment.service';
import { GdprUserDeleteConsumer } from './gdpr-user-delete.consumer';

@Module({
  imports: [
    SharedConfigModule,
    DatabaseModule,
    TypeOrmModule.forFeature([ServerSettings, Guild]),
    RedisModule.forRootAsync(),
    ClickHouseModule.forRootAsync(),
  ],
  providers: [
    ClickHouseIngestorService,
    VoiceSessionService,
    GuildSettingsEnrichmentService,
    IngestorQueueConsumer,
    GdprUserDeleteConsumer,
  ],
})
export class IngestorModule {}
