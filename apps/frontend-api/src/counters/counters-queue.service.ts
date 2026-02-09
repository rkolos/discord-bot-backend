import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  COUNTERS_UPDATE_QUEUE_NAME,
  type CounterUpdateJobPayload,
  SharedConfigService,
} from '@app/shared';
import type { Counter } from '@app/shared';

export { COUNTERS_UPDATE_QUEUE_NAME, type CounterUpdateJobPayload };

@Injectable()
export class CountersQueueService implements OnModuleDestroy {
  private readonly queue: Queue;

  constructor(private readonly sharedConfig: SharedConfigService) {
    const { host, port, password, prefix } = this.sharedConfig.redis;
    this.queue = new Queue<CounterUpdateJobPayload>(COUNTERS_UPDATE_QUEUE_NAME, {
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

  async addCounterUpdate(counter: Counter, priority?: number): Promise<void> {
    await this.queue.add(
      'update',
      {
        counter_id: counter.id,
        guild_id: counter.guildId,
        channel_id: counter.channelId,
        type: counter.type,
        metric: counter.metric,
        role_id: counter.roleId ?? undefined,
      },
      { priority: priority ?? 0 },
    );
  }

  async addCounterDelete(counterId: string, guildId: string, channelId: string): Promise<void> {
    await this.queue.add(
      'delete',
      {
        counter_id: counterId,
        guild_id: guildId,
        channel_id: channelId,
        type: 'delete',
      },
      { priority: 0 },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
