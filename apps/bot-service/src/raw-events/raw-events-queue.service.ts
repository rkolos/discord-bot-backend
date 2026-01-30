import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { SharedConfigService } from '@app/shared';
import {
  INGESTOR_RAW_EVENTS_QUEUE_NAME,
  type RawEventJobPayload,
} from './raw-events-queue.types';

export { INGESTOR_RAW_EVENTS_QUEUE_NAME };

@Injectable()
export class RawEventsQueueService implements OnModuleDestroy {
  private readonly queue: Queue<RawEventJobPayload>;

  constructor(private readonly sharedConfig: SharedConfigService) {
    const { host, port, password, prefix } = this.sharedConfig.redis;
    this.queue = new Queue<RawEventJobPayload>(INGESTOR_RAW_EVENTS_QUEUE_NAME, {
      connection: {
        host,
        port,
        password: password ?? undefined,
      },
      prefix,
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }

  async addInteractionEvent(payload: RawEventJobPayload): Promise<void> {
    await this.queue.add('interaction', payload, { priority: 0 });
  }

  async addRawEvent(payload: RawEventJobPayload): Promise<void> {
    await this.queue.add(payload.eventType, payload, { priority: 0 });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
