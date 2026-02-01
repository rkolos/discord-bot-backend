import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import {
  HISTORY_SYNC_QUEUE_NAME,
  type HistorySyncJobPayload,
  SharedConfigService,
} from '@app/shared';
import { GuildSettingsEnrichmentService } from '../guild-settings-enrichment.service';
import { HistorySyncService } from './history-sync.service';

@Injectable()
export class HistorySyncConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HistorySyncConsumer.name);
  private worker: Worker<HistorySyncJobPayload, void> | null = null;

  constructor(
    private readonly config: SharedConfigService,
    private readonly historySyncService: HistorySyncService,
    private readonly guildSettings: GuildSettingsEnrichmentService,
  ) {}

  async onModuleInit(): Promise<void> {
    const { host, port, password, prefix } = this.config.redis;
    this.worker = new Worker<HistorySyncJobPayload, void>(
      HISTORY_SYNC_QUEUE_NAME,
      this.processJob.bind(this),
      {
        connection: { host, port, password: password ?? undefined },
        prefix,
        concurrency: 1,
      },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.warn(`History sync job ${job?.id} failed: ${(err as Error).message}`);
    });
    this.logger.log(`Consuming queue ${HISTORY_SYNC_QUEUE_NAME}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }

  private async processJob(job: {
    id?: string;
    data: HistorySyncJobPayload;
  }): Promise<void> {
    const { guildId, discordGuildId } = job.data;
    if (!guildId || !discordGuildId) {
      this.logger.warn(`History sync job ${job.id}: missing guildId or discordGuildId`);
      return;
    }

    const enrichment = await this.guildSettings.getSettings(guildId);
    await this.historySyncService.run(guildId, discordGuildId, enrichment);
  }
}
