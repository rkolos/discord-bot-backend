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

@Injectable()
export class GuildSyncService {
  constructor(
    @InjectEntityManager()
    private readonly manager: EntityManager,
    private readonly guildSetupQueue: GuildSetupQueueProducerService,
  ) {}

  async onReady(options: SyncOnReadyOptions): Promise<void> {
    return syncOnReady(this.manager, options);
  }

  async onGuildCreate(options: SyncOnGuildCreateOptions): Promise<void> {
    const firstContact = await syncOnGuildCreate(this.manager, options);
    if (firstContact) {
      await this.guildSetupQueue.addGuildSetup(firstContact).catch(() => {});
    }
  }

  async onGuildDelete(options: SyncOnGuildDeleteOptions): Promise<void> {
    return syncOnGuildDelete(this.manager, options);
  }
}
