import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  HISTORY_SYNC_QUEUE_NAME,
  type HistorySyncJobPayload,
  SharedConfigService,
} from '@app/shared';

@Injectable()
export class HistorySyncQueueService implements OnModuleDestroy {
  private readonly queue: Queue<HistorySyncJobPayload>;

  constructor(private readonly sharedConfig: SharedConfigService) {
    const { host, port, password, prefix } = this.sharedConfig.redis;
    this.queue = new Queue<HistorySyncJobPayload>(HISTORY_SYNC_QUEUE_NAME, {
      connection: { host, port, password: password ?? undefined },
      prefix,
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }

  async addHistorySync(payload: HistorySyncJobPayload): Promise<void> {
    await this.queue.add('history-sync', payload, { priority: 10 });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
