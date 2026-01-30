import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import { ClickHouseService, SharedConfigService } from '@app/shared';

/** Имя очереди (должно совпадать с frontend-api GdprUserDeleteQueueService). */
export const GDPR_USER_DELETE_QUEUE_NAME = 'workers-queue-gdpr-user-delete';

interface GdprUserDeleteJobPayload {
  discordUserId: string;
}

@Injectable()
export class GdprUserDeleteConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GdprUserDeleteConsumer.name);
  private worker: Worker<GdprUserDeleteJobPayload, void> | null = null;

  constructor(
    private readonly config: SharedConfigService,
    private readonly clickhouse: ClickHouseService,
  ) {}

  async onModuleInit(): Promise<void> {
    const { host, port, password, prefix } = this.config.redis;
    this.worker = new Worker<GdprUserDeleteJobPayload, void>(
      GDPR_USER_DELETE_QUEUE_NAME,
      this.processJob.bind(this),
      {
        connection: { host, port, password: password ?? undefined },
        prefix,
        concurrency: 1,
      },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.warn(`GDPR delete job ${job?.id} failed: ${(err as Error).message}`);
    });
    this.logger.log(`Consuming queue ${GDPR_USER_DELETE_QUEUE_NAME}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }

  private async processJob(job: {
    id?: string;
    data: GdprUserDeleteJobPayload;
  }): Promise<void> {
    const { discordUserId } = job.data;
    if (!discordUserId || typeof discordUserId !== 'string') {
      this.logger.warn(`GDPR delete job ${job.id}: missing or invalid discordUserId`);
      return;
    }
    const database = this.config.clickhouse.database || 'default';
    const query = `ALTER TABLE ${database}.raw_events DELETE WHERE discord_user_id = {discordUserId:String}`;
    await this.clickhouse.exec({
      query,
      query_params: { discordUserId },
    });
    this.logger.log(`GDPR delete: executed ALTER TABLE DELETE for discord_user_id (job ${job.id})`);
  }
}
