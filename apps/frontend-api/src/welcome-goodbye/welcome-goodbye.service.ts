import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  GuildWelcomeGoodbyeSetting,
  type WelcomeGoodbyeContentEmbed,
  type WelcomeGoodbyeMessageType,
} from '@app/shared';
import { GuildsService } from '../guilds/guilds.service';
import { WelcomeGoodbyeQueueService } from './welcome-goodbye-queue.service';
import type { PatchWelcomeGoodbyeDto } from './dto';

export interface WelcomeGoodbyeSettingResponseDto {
  channelId: string | null;
  enabled: boolean;
  messageType: 'text' | 'embed' | 'text_and_embed';
  contentText: string | null;
  contentEmbed: WelcomeGoodbyeContentEmbed | null;
}

const DEFAULT_SETTING: WelcomeGoodbyeSettingResponseDto = {
  channelId: null,
  enabled: false,
  messageType: 'text',
  contentText: null,
  contentEmbed: null,
};

function toResponseDto(row: GuildWelcomeGoodbyeSetting | null): WelcomeGoodbyeSettingResponseDto {
  if (!row) return { ...DEFAULT_SETTING };
  return {
    channelId: row.channelId,
    enabled: row.enabled,
    messageType: row.messageType,
    contentText: row.contentText,
    contentEmbed: row.contentEmbed,
  };
}

@Injectable()
export class WelcomeGoodbyeService {
  constructor(
    @InjectRepository(GuildWelcomeGoodbyeSetting)
    private readonly settingsRepository: Repository<GuildWelcomeGoodbyeSetting>,
    private readonly guildsService: GuildsService,
    private readonly welcomeGoodbyeQueueService: WelcomeGoodbyeQueueService,
  ) {}

  async getWelcome(discordGuildId: string): Promise<WelcomeGoodbyeSettingResponseDto> {
    const guild = await this.guildsService.findGuildByIdOrDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const row = await this.settingsRepository.findOne({
      where: { guildId: guild.id, type: 'welcome' },
    });
    return toResponseDto(row);
  }

  async patchWelcome(
    discordGuildId: string,
    dto: PatchWelcomeGoodbyeDto,
  ): Promise<WelcomeGoodbyeSettingResponseDto> {
    const guild = await this.guildsService.findGuildByIdOrDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const existing = await this.settingsRepository.findOne({
      where: { guildId: guild.id, type: 'welcome' },
    });
    const channelId = dto.channelId !== undefined ? dto.channelId : (existing?.channelId ?? null);
    const enabled = dto.enabled !== undefined ? dto.enabled : (existing?.enabled ?? true);
    const messageType =
      (dto.messageType !== undefined ? dto.messageType : existing?.messageType ?? 'text') as WelcomeGoodbyeMessageType;
    const contentText = dto.contentText !== undefined ? dto.contentText : (existing?.contentText ?? null);
    const contentEmbed = dto.contentEmbed !== undefined ? dto.contentEmbed : (existing?.contentEmbed ?? null);

    if (existing) {
      existing.channelId = channelId;
      existing.enabled = enabled;
      existing.messageType = messageType;
      existing.contentText = contentText;
      existing.contentEmbed = contentEmbed;
      await this.settingsRepository.save(existing);
    } else {
      await this.settingsRepository.save(
        this.settingsRepository.create({
          guildId: guild.id,
          type: 'welcome',
          channelId,
          enabled,
          messageType,
          contentText,
          contentEmbed,
        }),
      );
    }
    await this.welcomeGoodbyeQueueService.addConfigUpdate({
      guild_id: guild.id,
      discord_guild_id: discordGuildId,
    }).catch(() => {});
    return this.getWelcome(discordGuildId);
  }

  async getGoodbye(discordGuildId: string): Promise<WelcomeGoodbyeSettingResponseDto> {
    const guild = await this.guildsService.findGuildByIdOrDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const row = await this.settingsRepository.findOne({
      where: { guildId: guild.id, type: 'goodbye' },
    });
    return toResponseDto(row);
  }

  async patchGoodbye(
    discordGuildId: string,
    dto: PatchWelcomeGoodbyeDto,
  ): Promise<WelcomeGoodbyeSettingResponseDto> {
    const guild = await this.guildsService.findGuildByIdOrDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const existing = await this.settingsRepository.findOne({
      where: { guildId: guild.id, type: 'goodbye' },
    });
    const channelId = dto.channelId !== undefined ? dto.channelId : (existing?.channelId ?? null);
    const enabled = dto.enabled !== undefined ? dto.enabled : (existing?.enabled ?? true);
    const messageType =
      (dto.messageType !== undefined ? dto.messageType : existing?.messageType ?? 'text') as WelcomeGoodbyeMessageType;
    const contentText = dto.contentText !== undefined ? dto.contentText : (existing?.contentText ?? null);
    const contentEmbed = dto.contentEmbed !== undefined ? dto.contentEmbed : (existing?.contentEmbed ?? null);

    if (existing) {
      existing.channelId = channelId;
      existing.enabled = enabled;
      existing.messageType = messageType;
      existing.contentText = contentText;
      existing.contentEmbed = contentEmbed;
      await this.settingsRepository.save(existing);
    } else {
      await this.settingsRepository.save(
        this.settingsRepository.create({
          guildId: guild.id,
          type: 'goodbye',
          channelId,
          enabled,
          messageType,
          contentText,
          contentEmbed,
        }),
      );
    }
    await this.welcomeGoodbyeQueueService.addConfigUpdate({
      guild_id: guild.id,
      discord_guild_id: discordGuildId,
    }).catch(() => {});
    return this.getGoodbye(discordGuildId);
  }
}
