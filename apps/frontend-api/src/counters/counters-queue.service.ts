import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { SharedConfigService } from '@app/shared';
import type { Counter } from '@app/shared';

/** Имя очереди (BullMQ не допускает ":" в имени). Полный ключ Redis: sn:{env}:workers-queue-counters-update */
export const COUNTERS_UPDATE_QUEUE_NAME = 'workers-queue-counters-update';

export interface CounterUpdateJobPayload {
  counter_id: string;
  guild_id: string;
  channel_id: string;
  type: string;
  metric?: string | null;
}

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
