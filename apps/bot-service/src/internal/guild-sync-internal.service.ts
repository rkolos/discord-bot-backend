import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CryptoService,
  Guild,
  RedisService,
  ServerSettings,
  SharedConfigService,
  publishGuildStateEvent,
} from '@app/shared';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const SYNC_LOCK_TTL_SEC = 120;
const ONLINE_MEMBERS_LAST_PREFIX = 'bot-service:guild-state:online-members:';

interface DiscordGuildResponse {
  name?: string;
  icon?: string | null;
  banner?: string | null;
  approximate_member_count?: number;
  approximate_presence_count?: number;
}

@Injectable()
export class GuildSyncInternalService {
  private readonly logger = new Logger(GuildSyncInternalService.name);

  constructor(
    @InjectRepository(Guild)
    private readonly guildRepository: Repository<Guild>,
    @InjectRepository(ServerSettings)
    private readonly serverSettingsRepository: Repository<ServerSettings>,
    private readonly crypto: CryptoService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    private readonly sharedConfig: SharedConfigService,
  ) {}

  async syncGuild(guildId: string): Promise<{
    success: boolean;
    syncedAt: string;
  }> {
    const guild = await this.guildRepository.findOne({
      where: { id: guildId },
    });
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: `Guild with id '${guildId}' not found`,
      });
    }

    const lockKey = this.getLockKey(guildId);
    const client = this.redis.getClient();
    const acquired = await client.set(lockKey, '1', 'EX', SYNC_LOCK_TTL_SEC, 'NX');
    if (!acquired) {
      throw new ConflictException({
        code: 'SYNC_IN_PROGRESS',
        message: 'Sync already in progress for this guild',
      });
    }

    try {
      const token = await this.resolveToken(guildId);
      const discordData = await this.fetchGuildFromDiscord(
        guild.discordGuildId,
        token,
      );

      guild.name = discordData.name ?? guild.name;
      guild.iconUrl = discordData.icon
        ? `https://cdn.discordapp.com/icons/${guild.discordGuildId}/${discordData.icon}.png`
        : guild.iconUrl;
      guild.banner = discordData.banner
        ? `https://cdn.discordapp.com/banners/${guild.discordGuildId}/${discordData.banner}.png`
        : guild.banner;
      guild.memberCount = discordData.approximate_member_count ?? guild.memberCount;
      guild.onlineMembers =
        discordData.approximate_presence_count ?? guild.onlineMembers ?? null;
      await this.guildRepository.save(guild);

      const settings = await this.serverSettingsRepository.findOne({
        where: { guildId },
      });
      if (settings) {
        settings.lastSyncAt = new Date();
        await this.serverSettingsRepository.save(settings);
      }

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
      if (settings?.lastSyncAt) {
        publishGuildStateEvent(this.redis.getClient(), this.sharedConfig.redis.prefix, {
          guildId: guild.id,
          discordGuildId: guild.discordGuildId,
          parameter: 'lastSyncAt',
          direction: 'set',
          value: settings.lastSyncAt.toISOString(),
        });
      }
      const onlineMembersValue = guild.onlineMembers ?? 0;
      publishGuildStateEvent(this.redis.getClient(), this.sharedConfig.redis.prefix, {
        guildId: guild.id,
        discordGuildId: guild.discordGuildId,
        parameter: 'onlineMembers',
        direction: 'set',
        value: onlineMembersValue,
      });
      const lastKey = `${this.sharedConfig.redis.prefix}${ONLINE_MEMBERS_LAST_PREFIX}${guild.id}`;
      await this.redis.getClient().set(lastKey, String(onlineMembersValue)).catch(() => {});

      const syncedAt = new Date().toISOString();
      return { success: true, syncedAt };
    } finally {
      await client.del(lockKey);
    }
  }

  private getLockKey(guildId: string): string {
    return `bot-service:guild-sync:${guildId}`;
  }

  private async resolveToken(guildId: string): Promise<string> {
    const settings = await this.serverSettingsRepository.findOne({
      where: { guildId },
      select: ['botTokenEncrypted'],
    });
    if (settings?.botTokenEncrypted) {
      try {
        return this.crypto.decrypt(settings.botTokenEncrypted);
      } catch (err) {
        this.logger.warn(
          `Failed to decrypt token for guild ${guildId}: ${(err as Error).message}`,
        );
      }
    }
    const mainToken = this.configService.get<string>('DISCORD_BOT_TOKEN');
    if (!mainToken) {
      throw new ServiceUnavailableException({
        code: 'DISCORD_UNAVAILABLE',
        message: 'Discord API or sync service unavailable',
      });
    }
    return mainToken;
  }

  private async fetchGuildFromDiscord(
    discordGuildId: string,
    token: string,
  ): Promise<DiscordGuildResponse> {
    const url = `${DISCORD_API_BASE}/guilds/${discordGuildId}?with_counts=true`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.status === 404) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: `Guild not found in Discord`,
      });
    }
    if (!res.ok) {
      this.logger.warn(
        `Discord API error for guild ${discordGuildId}: ${res.status} ${await res.text()}`,
      );
      throw new ServiceUnavailableException({
        code: 'DISCORD_UNAVAILABLE',
        message: 'Discord API or sync service unavailable',
      });
    }

    return (await res.json()) as DiscordGuildResponse;
  }
}
