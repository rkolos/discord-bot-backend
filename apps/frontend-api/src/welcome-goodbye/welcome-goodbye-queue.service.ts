import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { SharedConfigService } from '@app/shared';

/** Имя очереди (BullMQ не допускает ":" в имени). Полный ключ Redis: sn:{env}:workers-queue-welcome-goodbye-config */
export const WELCOME_GOODBYE_CONFIG_QUEUE_NAME = 'workers-queue-welcome-goodbye-config';

export interface WelcomeGoodbyeConfigJobPayload {
  guild_id: string;
  discord_guild_id: string;
}

@Injectable()
export class WelcomeGoodbyeQueueService implements OnModuleDestroy {
  private readonly queue: Queue<WelcomeGoodbyeConfigJobPayload>;

  constructor(private readonly sharedConfig: SharedConfigService) {
    const { host, port, password, prefix } = this.sharedConfig.redis;
    this.queue = new Queue<WelcomeGoodbyeConfigJobPayload>(WELCOME_GOODBYE_CONFIG_QUEUE_NAME, {
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

  async addConfigUpdate(payload: WelcomeGoodbyeConfigJobPayload): Promise<void> {
    await this.queue.add('config-update', payload, { priority: 0 });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
