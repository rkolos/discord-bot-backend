import type { EntityManager } from 'typeorm';
import { Guild, GuildStatus, ServerSettings } from '@app/shared';

export interface SyncOnReadyOptions {
  discordGuildId: string;
  botUserId: string;
  shardId: number;
  /** UUID гильдии в БД (для кастомного токена — server_settings.guild_id). */
  guildIdUuid?: string;
  /** true если это кастомный бот (одна гильдия на клиента). */
  isCustomToken?: boolean;
}

export interface SyncOnGuildCreateOptions {
  discordGuildId: string;
  guildName: string;
  shardId: number;
  /** Discord Snowflake ID владельца гильдии (для First Contact). */
  discordOwnerId?: string;
}

export interface FirstContactPayload {
  discordGuildId: string;
  guildName: string;
  discordOwnerId: string;
}

export interface SyncedGuildPayload {
  syncedGuildId: string;
}

export interface SyncOnGuildDeleteOptions {
  discordGuildId: string;
}

/**
 * Обновление БД при READY (для кастомного клиента — одна гильдия).
 * Для основного шарда READY обновляет только heartbeat; гильдии обновляются при GUILD_CREATE.
 */
export async function syncOnReady(
  manager: EntityManager,
  options: SyncOnReadyOptions,
): Promise<void> {
  const { guildIdUuid, botUserId, isCustomToken } = options;
  if (!isCustomToken || !guildIdUuid) return;

  const settings = await manager.findOne(ServerSettings, {
    where: { guildId: guildIdUuid },
  });
  if (!settings) return;

  settings.botConnected = true;
  settings.botUserId = botUserId;
  settings.lastConnected = new Date();
  await manager.save(ServerSettings, settings);
}

/**
 * Обновление БД при GUILD_CREATE: если гильдия есть в БД — обновляем is_bot_in_guild, shard_id, server_settings
 * и возвращаем syncedGuildId для вызова syncGuild. Если гильдии нет — возвращает FirstContactPayload для guild:setup.
 */
export async function syncOnGuildCreate(
  manager: EntityManager,
  options: SyncOnGuildCreateOptions,
): Promise<FirstContactPayload | SyncedGuildPayload | null> {
  const { discordGuildId, guildName, shardId, discordOwnerId } = options;

  const guild = await manager.findOne(Guild, {
    where: { discordGuildId },
  });
  if (!guild) {
    console.log(
      `[guild-sync] GUILD_CREATE: guild not in DB (discordGuildId=${discordGuildId}, name=${guildName}). Enqueueing guild:setup.`,
    );
    if (discordOwnerId) {
      return { discordGuildId, guildName, discordOwnerId };
    }
    return null;
  }

  guild.isBotInGuild = true;
  guild.shardId = shardId;
  await manager.save(Guild, guild);

  const settings = await manager.findOne(ServerSettings, {
    where: { guildId: guild.id },
  });
  if (settings) {
    settings.botConnected = true;
    settings.lastConnected = new Date();
    await manager.save(ServerSettings, settings);
  }
  console.log(
    `[guild-sync] GUILD_CREATE: updated guild in DB (discordGuildId=${discordGuildId}, guildId=${guild.id}, isBotInGuild=true)`,
  );
  return { syncedGuildId: guild.id };
}

/**
 * Обновление БД при GUILD_DELETE: status = inactive, is_bot_in_guild = false.
 */
export async function syncOnGuildDelete(
  manager: EntityManager,
  options: SyncOnGuildDeleteOptions,
): Promise<void> {
  const { discordGuildId } = options;

  const guild = await manager.findOne(Guild, {
    where: { discordGuildId },
  });
  if (!guild) return;

  guild.status = GuildStatus.INACTIVE;
  guild.isBotInGuild = false;
  await manager.save(Guild, guild);
}
