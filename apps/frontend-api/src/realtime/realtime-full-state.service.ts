import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guild, ServerSettings, SharedAnalyticsService } from '@app/shared';
import type { GuildStateEventPayload } from '@app/shared';
import { GuildsRealtimeService } from '../guilds/guilds-realtime.service';
import { GuildStateGateway } from './guild-state.gateway';

@Injectable()
export class RealtimeFullStateService {
  constructor(
    private readonly guildsRealtimeService: GuildsRealtimeService,
    private readonly guildStateGateway: GuildStateGateway,
    @InjectRepository(Guild)
    private readonly guildRepository: Repository<Guild>,
    @InjectRepository(ServerSettings)
    private readonly serverSettingsRepository: Repository<ServerSettings>,
    private readonly sharedAnalytics: SharedAnalyticsService,
  ) {}

  /**
   * Собирает текущее состояние гильдии из БД/аналитики и отправляет его в сокет
   * (комната guild:${guild.id}) в виде событий guild-state. Возвращает количество отправленных событий.
   */
  async emitFullStateForGuild(guildIdParam: string): Promise<number> {
    const guild = await this.guildsRealtimeService.findGuildByIdOrDiscordId(guildIdParam);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found',
      });
    }

    const settings = await this.serverSettingsRepository.findOne({
      where: { guildId: guild.id },
    });

    const ts = new Date().toISOString();
    const payloads: GuildStateEventPayload[] = [];

    const base = {
      guildId: guild.id,
      discordGuildId: guild.discordGuildId,
      direction: 'set' as const,
      timestamp: ts,
    };

    payloads.push({
      ...base,
      parameter: 'guildInfo',
      value: {
        name: guild.name,
        iconUrl: guild.iconUrl ?? undefined,
        banner: guild.banner ?? undefined,
      },
    });

    payloads.push({
      ...base,
      parameter: 'memberCount',
      value: guild.memberCount,
    });

    payloads.push({
      ...base,
      parameter: 'onlineMembers',
      value: guild.onlineMembers ?? 0,
    });

    if (guild.lastActivity != null) {
      payloads.push({
        ...base,
        parameter: 'lastActivity',
        value: guild.lastActivity instanceof Date ? guild.lastActivity.toISOString() : String(guild.lastActivity),
      });
    }

    payloads.push({
      ...base,
      parameter: 'historySyncStatus',
      value: guild.historySyncStatus,
    });

    payloads.push({
      ...base,
      parameter: 'isBotInGuild',
      value: guild.isBotInGuild,
    });

    if (settings) {
      payloads.push({
        ...base,
        parameter: 'botConnected',
        value: settings.botConnected,
      });

      if (settings.lastSyncAt != null) {
        payloads.push({
          ...base,
          parameter: 'lastSyncAt',
          value: settings.lastSyncAt instanceof Date ? settings.lastSyncAt.toISOString() : String(settings.lastSyncAt),
        });
      }

      const botStatus = settings.botTokenEncrypted && settings.botConnected ? 'installed' : 'not_installed';
      payloads.push({
        ...base,
        parameter: 'bot_status',
        value: botStatus,
      });
    } else {
      payloads.push({
        ...base,
        parameter: 'botConnected',
        value: false,
      });
      payloads.push({
        ...base,
        parameter: 'bot_status',
        value: 'not_installed',
      });
    }

    try {
      const totalMessages = await this.sharedAnalytics.getTotalMessagesByGuildId(guild.id);
      payloads.push({
        ...base,
        parameter: 'totalMessages',
        value: totalMessages,
      });
    } catch {
      // ClickHouse недоступен — не добавляем totalMessages
    }

    for (const payload of payloads) {
      this.guildStateGateway.broadcastToGuild(guild.id, payload);
    }

    return payloads.length;
  }
}
