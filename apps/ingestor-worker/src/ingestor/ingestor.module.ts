import { Module } from '@nestjs/common';
import { ClickHouseModule, RedisModule, SharedConfigModule } from '@app/shared';
import { ClickHouseIngestorService } from './clickhouse-ingestor.service';
import { VoiceSessionService } from './voice-session.service';
import { IngestorQueueConsumer } from './ingestor-queue.consumer';

@Module({
  imports: [
    SharedConfigModule,
    RedisModule.forRootAsync(),
    ClickHouseModule.forRootAsync(),
  ],
  providers: [
    ClickHouseIngestorService,
    VoiceSessionService,
    IngestorQueueConsumer,
  ],
})
export class IngestorModule {}
