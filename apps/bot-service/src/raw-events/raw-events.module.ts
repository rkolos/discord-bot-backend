import { Module } from '@nestjs/common';
import { RawEventsQueueService } from './raw-events-queue.service';

@Module({
  providers: [RawEventsQueueService],
  exports: [RawEventsQueueService],
})
export class RawEventsModule {}
