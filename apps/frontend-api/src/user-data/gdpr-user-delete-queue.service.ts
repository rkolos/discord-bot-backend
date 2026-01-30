import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { SharedConfigService } from '@app/shared';

/** Имя очереди (BullMQ не допускает ":" в имени). Полный ключ Redis: sn:{env}:workers-queue-gdpr-user-delete */
export const GDPR_USER_DELETE_QUEUE_NAME = 'workers-queue-gdpr-user-delete';

export interface GdprUserDeleteJobPayload {
  discordUserId: string;
}

@Injectable()
export class GdprUserDeleteQueueService implements OnModuleDestroy {
  private readonly queue: Queue<GdprUserDeleteJobPayload>;

  constructor(private readonly sharedConfig: SharedConfigService) {
    const { host, port, password, prefix } = this.sharedConfig.redis;
    this.queue = new Queue<GdprUserDeleteJobPayload>(GDPR_USER_DELETE_QUEUE_NAME, {
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

  async addGdprUserDelete(payload: GdprUserDeleteJobPayload): Promise<void> {
    await this.queue.add('gdpr-user-delete', payload, { priority: 0 });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
