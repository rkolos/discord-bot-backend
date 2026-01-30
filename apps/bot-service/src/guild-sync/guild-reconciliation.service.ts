import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { InjectEntityManager } from '@nestjs/typeorm';
import { In, IsNull, Not } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { Guild, ServerSettings } from '@app/shared';
import { GuildSyncService } from './guild-sync.service';
import { MultiTokenConnectionManagerService } from '../multi-token/multi-token-connection-manager.service';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const GUILDS_PAGE_LIMIT = 200;

interface DiscordPartialGuild {
  id: string;
  name: string;
  icon: string | null;
}

@Injectable()
export class GuildReconciliationService {
  private readonly logger = new Logger(GuildReconciliationService.name);

  constructor(
    @InjectEntityManager()
    private readonly manager: EntityManager,
    private readonly guildSync: GuildSyncService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly multiToken: MultiTokenConnectionManagerService,
  ) {}

  /**
   * По расписанию: каждые 15 минут.
   * Отключение: GUILD_RECONCILIATION_ENABLED=false.
   */
  @Cron('0 */15 * * * *')
  async runScheduledReconciliation(): Promise<void> {
    await this.reconcile();
  }

  /**
   * Сверка состояния гильдий с Discord API (основной бот) и кэшем клиентов (кастомные токены).
   */
  async reconcile(): Promise<void> {
    const enabled = this.configService.get<string>('GUILD_RECONCILIATION_ENABLED');
    if (enabled === 'false' || enabled === '0') {
      return;
    }

    try {
      await this.reconcileMainBot();
      await this.reconcileCustomTokens();
    } catch (err) {
      this.logger.warn(`Reconciliation error: ${(err as Error).message}`);
    }
  }

  private async reconcileMainBot(): Promise<void> {
    const token = this.configService.get<string>('DISCORD_BOT_TOKEN');
    if (!token || typeof token !== 'string') {
      return;
    }

    let apiGuildIds: Set<string>;
    try {
      apiGuildIds = await this.fetchMainBotGuildIds(token);
    } catch (err) {
      this.logger.warn(
        `Main bot guild list fetch failed: ${(err as Error).message}`,
      );
      return;
    }

    const customTokenGuildIds = this.multiToken.getCustomGuildIds();
    const customDiscordIds = new Set(customTokenGuildIds.values());

    const customTokenGuildIdUuids = await this.manager
      .getRepository(ServerSettings)
      .find({
        where: { botTokenEncrypted: Not(IsNull()) },
        select: ['guildId'],
      })
      .then((rows) => rows.map((r) => r.guildId).filter(Boolean));

    const mainBotGuilds =
      customTokenGuildIdUuids.length > 0
        ? await this.manager.getRepository(Guild).find({
            where: {
              isBotInGuild: true,
              id: Not(In(customTokenGuildIdUuids)),
            },
            select: ['id', 'discordGuildId', 'name'],
          })
        : await this.manager.getRepository(Guild).find({
            where: { isBotInGuild: true },
            select: ['id', 'discordGuildId', 'name'],
          });

    for (const guild of mainBotGuilds) {
      if (customDiscordIds.has(guild.discordGuildId)) {
        continue;
      }
      if (!apiGuildIds.has(guild.discordGuildId)) {
        await this.guildSync.onGuildDelete({
          discordGuildId: guild.discordGuildId,
        });
        this.logger.debug(
          `Reconciliation: marked guild ${guild.discordGuildId} as left (main bot)`,
        );
      }
    }

    for (const discordGuildId of apiGuildIds) {
      if (customDiscordIds.has(discordGuildId)) {
        continue;
      }
      const guild = await this.manager.findOne(Guild, {
        where: { discordGuildId },
        select: ['id', 'discordGuildId', 'name', 'isBotInGuild'],
      });
      if (guild && !guild.isBotInGuild) {
        await this.guildSync.onGuildCreate({
          discordGuildId: guild.discordGuildId,
          guildName: guild.name,
          shardId: 0,
        });
        this.logger.debug(
          `Reconciliation: marked guild ${guild.discordGuildId} as joined (main bot)`,
        );
      }
    }
  }

  private async fetchMainBotGuildIds(token: string): Promise<Set<string>> {
    const result = new Set<string>();
    let after: string | undefined;

    do {
      const params = new URLSearchParams();
      params.set('limit', String(GUILDS_PAGE_LIMIT));
      if (after) params.set('after', after);

      const response = await firstValueFrom(
        this.httpService.get<DiscordPartialGuild[]>(
          `${DISCORD_API_BASE}/users/@me/guilds?${params.toString()}`,
          {
            headers: { Authorization: `Bot ${token}` },
            validateStatus: (status) =>
              status === 200 || status === 401 || status === 403 || status === 429,
          },
        ),
      );

      if (response.status === 401 || response.status === 403) {
        this.logger.warn('Discord API auth failed for main bot guild list');
        throw new Error('Discord API auth failed');
      }
      if (response.status === 429) {
        const retryAfter = response.headers['retry-after'];
        const delayMs = retryAfter
          ? parseInt(String(retryAfter), 10) * 1000
          : 60_000;
        this.logger.warn(
          `Discord API rate limit, retry after ${delayMs}ms`,
        );
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      if (response.status !== 200 || !Array.isArray(response.data)) {
        throw new Error(`Discord API error: ${response.status}`);
      }

      const page = response.data as DiscordPartialGuild[];
      for (const g of page) {
        result.add(g.id);
      }
      if (page.length < GUILDS_PAGE_LIMIT) {
        break;
      }
      after = page[page.length - 1]?.id;
    } while (after);

    return result;
  }

  private async reconcileCustomTokens(): Promise<void> {
    const customGuilds = this.multiToken.getCustomGuildIds();
    for (const [guildIdUuid, discordGuildId] of customGuilds) {
      const inCache = this.multiToken.isGuildInCache(guildIdUuid);
      const guild = await this.manager.findOne(Guild, {
        where: { discordGuildId },
        select: ['id', 'discordGuildId', 'name', 'isBotInGuild'],
      });
      if (!guild) continue;

      if (!inCache) {
        if (guild.isBotInGuild) {
          await this.guildSync.onGuildDelete({
            discordGuildId,
          });
          this.logger.debug(
            `Reconciliation: marked guild ${discordGuildId} as left (custom token)`,
          );
        }
      } else {
        if (!guild.isBotInGuild) {
          await this.guildSync.onGuildCreate({
            discordGuildId: guild.discordGuildId,
            guildName: guild.name,
            shardId: 0,
          });
          this.logger.debug(
            `Reconciliation: marked guild ${guild.discordGuildId} as joined (custom token)`,
          );
        }
      }
    }
  }
}
