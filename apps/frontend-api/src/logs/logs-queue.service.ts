import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { SharedConfigService } from '@app/shared';

/** Имя очереди (BullMQ не допускает ":" в имени). Полный ключ Redis: sn:{env}:workers-queue-logs-config */
export const LOGS_CONFIG_QUEUE_NAME = 'workers-queue-logs-config';

export interface LogsConfigJobPayload {
  guild_id: string;
  discord_guild_id: string;
}

@Injectable()
export class LogsQueueService implements OnModuleDestroy {
  private readonly queue: Queue<LogsConfigJobPayload>;

  constructor(private readonly sharedConfig: SharedConfigService) {
    const { host, port, password, prefix } = this.sharedConfig.redis;
    this.queue = new Queue<LogsConfigJobPayload>(LOGS_CONFIG_QUEUE_NAME, {
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

  async addLogsConfigUpdate(payload: LogsConfigJobPayload): Promise<void> {
    await this.queue.add('config-update', payload, { priority: 0 });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
