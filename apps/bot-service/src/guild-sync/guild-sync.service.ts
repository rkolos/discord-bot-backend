import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import type { EntityManager } from 'typeorm';
import type {
  SyncOnReadyOptions,
  SyncOnGuildCreateOptions,
  SyncOnGuildDeleteOptions,
} from './guild-sync.updates';
import {
  syncOnReady,
  syncOnGuildCreate,
  syncOnGuildDelete,
} from './guild-sync.updates';
import { GuildSetupQueueProducerService } from '../guild-setup-queue-producer/guild-setup-queue-producer.service';
import { GuildSyncInternalService } from '../internal/guild-sync-internal.service';

@Injectable()
export class GuildSyncService {
  constructor(
    @InjectEntityManager()
    private readonly manager: EntityManager,
    private readonly guildSetupQueue: GuildSetupQueueProducerService,
    private readonly guildSyncInternal: GuildSyncInternalService,
  ) {}

  async onReady(options: SyncOnReadyOptions): Promise<void> {
    return syncOnReady(this.manager, options);
  }

  async onGuildCreate(options: SyncOnGuildCreateOptions): Promise<void> {
    const result = await syncOnGuildCreate(this.manager, options);
    if (result) {
      if ('syncedGuildId' in result) {
        await this.guildSyncInternal.syncGuild(result.syncedGuildId).catch(() => {});
      } else {
        await this.guildSetupQueue.addGuildSetup(result).catch(() => {});
      }
    }
  }

  async onGuildDelete(options: SyncOnGuildDeleteOptions): Promise<void> {
    return syncOnGuildDelete(this.manager, options);
  }
}
