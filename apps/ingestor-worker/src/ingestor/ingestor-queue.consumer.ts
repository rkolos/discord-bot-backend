import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SharedConfigService } from '@app/shared';
import type { RawEvent } from './ingestor.types';
import { RawEventDto } from './dto/raw-event.dto';
import { ClickHouseIngestorService } from './clickhouse-ingestor.service';
import { VoiceSessionService } from './voice-session.service';
import {
  GuildSettingsEnrichmentService,
  type GuildSettingsEnrichment,
} from './guild-settings-enrichment.service';

export const INGESTOR_RAW_EVENTS_QUEUE_NAME = 'ingestor-raw-events';

interface IngestorJobPayload {
  eventId: string;
  eventType: string;
  eventTime: string;
  guildId: string;
  discordGuildId: string;
  userId?: string | null;
  discordUserId?: string | null;
  channelId?: string | null;
  planTier?: string | null;
  payload?: Record<string, unknown> | null;
  roleId?: string | null;
  commandName?: string | null;
  isBotGenerated?: boolean;
}

@Injectable()
export class IngestorQueueConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestorQueueConsumer.name);
  private worker: Worker<IngestorJobPayload, void> | null = null;

  constructor(
    private readonly config: SharedConfigService,
    private readonly clickhouseIngestor: ClickHouseIngestorService,
    private readonly voiceSession: VoiceSessionService,
    private readonly guildSettings: GuildSettingsEnrichmentService,
  ) {}

  async onModuleInit(): Promise<void> {
    const { host, port, password, prefix } = this.config.redis;
    this.worker = new Worker<IngestorJobPayload, void>(
      INGESTOR_RAW_EVENTS_QUEUE_NAME,
      this.processJob.bind(this),
      {
        connection: { host, port, password: password ?? undefined },
        prefix,
        concurrency: 1,
      },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.warn(`Job ${job?.id} failed: ${(err as Error).message}`);
    });
    this.logger.log(`Consuming queue ${INGESTOR_RAW_EVENTS_QUEUE_NAME}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }

  private async processJob(job: { id?: string; data: IngestorJobPayload }): Promise<void> {
    const dto = plainToInstance(RawEventDto, job.data, {
      enableImplicitConversion: true,
    });
    const errors = await validate(dto);
    if (errors.length > 0) {
      const msg = errors.map((e) => Object.values(e.constraints ?? {}).join('; ')).join(' ');
      this.logger.warn(`Validation failed for job ${job.id}: ${msg}`);
      throw new Error(`Validation failed: ${msg}`);
    }

    const enrichment = await this.guildSettings.getSettings(dto.guildId);

    if (dto.eventType === 'VOICE_STATE_UPDATE') {
      const userId = dto.discordUserId ?? dto.userId ?? null;
      if (!userId) {
        this.logger.warn(`VOICE_STATE_UPDATE missing discordUserId/userId for job ${job.id}`);
      }
      const channelId = dto.channelId ?? (dto.payload as { channelId?: string })?.channelId;
      const isJoin = Boolean(channelId && String(channelId).trim());
      if (isJoin && userId) {
        await this.voiceSession.recordJoin(dto.guildId, userId);
        return;
      }
      if (!isJoin && userId) {
        const leave = await this.voiceSession.recordLeave(dto.guildId, userId);
        const payload = { ...((dto.payload as Record<string, unknown>) ?? {}), voiceMinutes: leave?.voiceMinutes ?? 0 };
        const raw = toRawEvent(dto, payload, enrichment);
        this.clickhouseIngestor.pushEvent(raw);
        return;
      }
      if (!isJoin && !userId) {
        const raw = toRawEvent(dto, (dto.payload as Record<string, unknown>) ?? {}, enrichment);
        this.clickhouseIngestor.pushEvent(raw);
        return;
      }
    }

    const raw = toRawEvent(dto, (dto.payload as Record<string, unknown>) ?? {}, enrichment);
    this.clickhouseIngestor.pushEvent(raw);
  }
}

function toRawEvent(
  dto: RawEventDto,
  payload: Record<string, unknown>,
  enrichment: GuildSettingsEnrichment,
): RawEvent {
  return {
    eventId: dto.eventId,
    eventTime: dto.eventTime,
    eventType: dto.eventType,
    guildId: dto.guildId,
    discordGuildId: dto.discordGuildId,
    userId: dto.userId ?? undefined,
    discordUserId: dto.discordUserId ?? undefined,
    channelId: dto.channelId ?? undefined,
    roleId: dto.roleId ?? undefined,
    commandName: dto.commandName ?? undefined,
    planTier: (dto.planTier as string) ?? enrichment.planTier,
    isBotGenerated: dto.isBotGenerated ?? false,
    payload: JSON.stringify(payload),
    isHistorical: false,
    anonymizeUserData: enrichment.anonymizeUserData,
  };
}
