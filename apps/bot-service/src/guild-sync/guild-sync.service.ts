import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import type { EntityManager } from 'typeorm';
import { Guild, SharedConfigService } from '@app/shared';
import { publishGuildStateEvent } from '@app/shared';
import { RedisService } from '@app/shared';
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
    private readonly redis: RedisService,
    private readonly sharedConfig: SharedConfigService,
  ) {}

  async onReady(options: SyncOnReadyOptions): Promise<void> {
    await syncOnReady(this.manager, options);
    if (options.guildIdUuid && options.isCustomToken) {
      const guild = await this.manager.findOne(Guild, {
        where: { id: options.guildIdUuid },
        select: ['id', 'discordGuildId'],
      });
      if (guild?.discordGuildId) {
        publishGuildStateEvent(this.redis.getClient(), this.sharedConfig.redis.prefix, {
          guildId: guild.id,
          discordGuildId: guild.discordGuildId,
          parameter: 'botConnected',
          direction: 'set',
          value: true,
        });
        publishGuildStateEvent(this.redis.getClient(), this.sharedConfig.redis.prefix, {
          guildId: guild.id,
          discordGuildId: guild.discordGuildId,
          parameter: 'bot_status',
          direction: 'set',
          value: 'installed',
        });
      }
    }
  }

  async onGuildCreate(options: SyncOnGuildCreateOptions): Promise<void> {
    const result = await syncOnGuildCreate(this.manager, options);
    if (result) {
      if ('syncedGuildId' in result) {
        publishGuildStateEvent(this.redis.getClient(), this.sharedConfig.redis.prefix, {
          guildId: result.syncedGuildId,
          discordGuildId: options.discordGuildId,
          parameter: 'isBotInGuild',
          direction: 'set',
          value: true,
        });
        publishGuildStateEvent(this.redis.getClient(), this.sharedConfig.redis.prefix, {
          guildId: result.syncedGuildId,
          discordGuildId: options.discordGuildId,
          parameter: 'botConnected',
          direction: 'set',
          value: true,
        });
        publishGuildStateEvent(this.redis.getClient(), this.sharedConfig.redis.prefix, {
          guildId: result.syncedGuildId,
          discordGuildId: options.discordGuildId,
          parameter: 'bot_status',
          direction: 'set',
          value: 'installed',
        });
        await this.guildSyncInternal.syncGuild(result.syncedGuildId).catch(() => {});
      } else {
        await this.guildSetupQueue.addGuildSetup(result).catch(() => {});
      }
    }
  }

  async onGuildDelete(options: SyncOnGuildDeleteOptions): Promise<void> {
    const guild = await this.manager.findOne(Guild, {
      where: { discordGuildId: options.discordGuildId },
      select: ['id', 'discordGuildId'],
    });
    await syncOnGuildDelete(this.manager, options);
    if (guild?.id) {
      publishGuildStateEvent(this.redis.getClient(), this.sharedConfig.redis.prefix, {
        guildId: guild.id,
        discordGuildId: options.discordGuildId,
        parameter: 'bot_status',
        direction: 'set',
        value: 'not_installed',
      });
      publishGuildStateEvent(this.redis.getClient(), this.sharedConfig.redis.prefix, {
        guildId: guild.id,
        discordGuildId: options.discordGuildId,
        parameter: 'isBotInGuild',
        direction: 'set',
        value: false,
      });
      publishGuildStateEvent(this.redis.getClient(), this.sharedConfig.redis.prefix, {
        guildId: guild.id,
        discordGuildId: options.discordGuildId,
        parameter: 'botConnected',
        direction: 'set',
        value: false,
      });
    }
  }

  /**
   * Обновляет данные гильдии (name, icon, banner) и публикует guildInfo.
   * Вызывается при guildUpdate, когда изменилось имя, иконка или баннер.
   */
  async onGuildUpdate(options: {
    discordGuildId: string;
    name: string;
    iconUrl: string | null;
    bannerUrl: string | null;
  }): Promise<void> {
    const guild = await this.manager.findOne(Guild, {
      where: { discordGuildId: options.discordGuildId },
      select: ['id', 'discordGuildId', 'name', 'iconUrl', 'banner'],
    });
    if (!guild) return;
    guild.name = options.name;
    guild.iconUrl = options.iconUrl ?? guild.iconUrl;
    guild.banner = options.bannerUrl ?? guild.banner;
    await this.manager.save(Guild, guild);
    publishGuildStateEvent(this.redis.getClient(), this.sharedConfig.redis.prefix, {
      guildId: guild.id,
      discordGuildId: guild.discordGuildId,
      parameter: 'guildInfo',
      direction: 'set',
      value: {
        name: guild.name,
        iconUrl: guild.iconUrl ?? null,
        banner: guild.banner ?? null,
      },
    });
  }

  /**
   * Публикует переход botConnected → false без изменения БД.
   * Используется при отключении/уничтожении клиента (disconnect, invalidated, destroy),
   * когда бот ещё в гильдии, но соединение потеряно.
   */
  publishBotDisconnected(options: { guildId: string; discordGuildId: string }): void {
    const { guildId, discordGuildId } = options;
    if (!discordGuildId) return;
    publishGuildStateEvent(this.redis.getClient(), this.sharedConfig.redis.prefix, {
      guildId,
      discordGuildId,
      parameter: 'botConnected',
      direction: 'set',
      value: false,
    });
  }
}
