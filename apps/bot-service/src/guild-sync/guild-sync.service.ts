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

@Injectable()
export class GuildSyncService {
  constructor(
    @InjectEntityManager()
    private readonly manager: EntityManager,
  ) {}

  async onReady(options: SyncOnReadyOptions): Promise<void> {
    return syncOnReady(this.manager, options);
  }

  async onGuildCreate(options: SyncOnGuildCreateOptions): Promise<void> {
    return syncOnGuildCreate(this.manager, options);
  }

  async onGuildDelete(options: SyncOnGuildDeleteOptions): Promise<void> {
    return syncOnGuildDelete(this.manager, options);
  }
}
