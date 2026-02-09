import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
    private readonly dataSource: DataSource,
    private readonly guildsService: GuildsService,
    private readonly logsQueueService: LogsQueueService,
  ) {}

  async getSettings(discordGuildId: string): Promise<LogSettingResponseDto[]> {
    const guild = await this.guildsService.findGuildByIdOrDiscordId(discordGuildId);
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
    const guild = await this.guildsService.findGuildByIdOrDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const repo = queryRunner.manager.getRepository(GuildLogSetting);
      const existingRows = await repo.find({ where: { guildId: guild.id } });
      const byType = new Map(existingRows.map((r) => [r.eventType, r]));

      let anyChanged = false;
      const toSave: GuildLogSetting[] = [];

      for (const item of dto.settings) {
        const existing = byType.get(item.eventType);
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
          toSave.push(existing);
        } else {
          anyChanged = true;
          toSave.push(
            repo.create({
              guildId: guild.id,
              eventType: item.eventType as LogEventType,
              channelId,
              enabled,
            }),
          );
        }
      }

      if (toSave.length > 0) {
        await repo.save(toSave);
      }

      await queryRunner.commitTransaction();
      if (anyChanged) {
        await this.logsQueueService.addLogsConfigUpdate({
          guild_id: guild.id,
          discord_guild_id: discordGuildId,
        }).catch(() => {});
      }
      return this.getSettings(discordGuildId);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  getEvents(): LogEventResponseDto[] {
    return LOG_EVENT_META.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
    }));
  }
}
