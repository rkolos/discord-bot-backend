import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuildLogSetting } from '@app/shared';
import { GuildsService } from '../guilds/guilds.service';
import { LogsQueueService } from './logs-queue.service';
import { LOG_EVENT_META, LOG_EVENT_TYPES } from './constants';
import type { LogEventType } from './constants';
import type { PatchLogSettingsDto } from './dto';

export interface LogSettingResponseDto {
  eventType: string;
  channelId: string | null;
  enabled: boolean;
}

export interface LogEventResponseDto {
  id: string;
  name: string;
  description: string;
}

function toSettingDto(eventType: string, channelId: string | null, enabled: boolean): LogSettingResponseDto {
  return { eventType, channelId, enabled };
}

@Injectable()
export class LogsService {
  constructor(
    @InjectRepository(GuildLogSetting)
    private readonly logSettingsRepository: Repository<GuildLogSetting>,
    private readonly guildsService: GuildsService,
    private readonly logsQueueService: LogsQueueService,
  ) {}

  async getSettings(discordGuildId: string): Promise<LogSettingResponseDto[]> {
    const guild = await this.guildsService.findGuildByDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const rows = await this.logSettingsRepository.find({
      where: { guildId: guild.id },
    });
    const byType = new Map<string, { channelId: string | null; enabled: boolean }>();
    for (const r of rows) {
      byType.set(r.eventType, { channelId: r.channelId, enabled: r.enabled });
    }
    return LOG_EVENT_TYPES.map((eventType) => {
      const row = byType.get(eventType);
      if (!row) {
        return toSettingDto(eventType, null, false);
      }
      return toSettingDto(eventType, row.channelId, row.enabled);
    });
  }

  async patchSettings(
    discordGuildId: string,
    dto: PatchLogSettingsDto,
  ): Promise<LogSettingResponseDto[]> {
    const guild = await this.guildsService.findGuildByDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    let anyChanged = false;
    for (const item of dto.settings) {
      const existing = await this.logSettingsRepository.findOne({
        where: { guildId: guild.id, eventType: item.eventType },
      });
      const channelId = item.channelId !== undefined ? (item.channelId ?? null) : (existing?.channelId ?? null);
      const enabled = item.enabled !== undefined ? item.enabled : (existing?.enabled ?? true);
      if (existing) {
        const channelChanged = existing.channelId !== channelId;
        const enabledChanged = existing.enabled !== enabled;
        if (channelChanged || enabledChanged) {
          anyChanged = true;
        }
        existing.channelId = channelId;
        existing.enabled = enabled;
        await this.logSettingsRepository.save(existing);
      } else {
        anyChanged = true;
        const created = this.logSettingsRepository.create({
          guildId: guild.id,
          eventType: item.eventType as LogEventType,
          channelId,
          enabled,
        });
        await this.logSettingsRepository.save(created);
      }
    }
    if (anyChanged) {
      await this.logsQueueService.addLogsConfigUpdate({
        guild_id: guild.id,
        discord_guild_id: discordGuildId,
      }).catch(() => {});
    }
    return this.getSettings(discordGuildId);
  }

  getEvents(): LogEventResponseDto[] {
    return LOG_EVENT_META.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
    }));
  }
}
