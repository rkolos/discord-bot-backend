import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  GUILD_SETUP_QUEUE_NAME,
  type GuildSetupJobPayload,
  SharedConfigService,
} from '@app/shared';

@Injectable()
export class GuildSetupQueueProducerService implements OnModuleDestroy {
  private readonly queue: Queue<GuildSetupJobPayload>;

  constructor(private readonly sharedConfig: SharedConfigService) {
    const { host, port, password, prefix } = this.sharedConfig.redis;
    this.queue = new Queue<GuildSetupJobPayload>(GUILD_SETUP_QUEUE_NAME, {
      connection: { host, port, password: password ?? undefined },
      prefix,
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }

  async addGuildSetup(payload: GuildSetupJobPayload): Promise<void> {
    await this.queue.add('setup', payload, { priority: 5 });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
