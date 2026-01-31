import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Widget } from '@app/shared';
import { GuildsService } from '../guilds/guilds.service';

export interface WidgetConfigDto {
  type?: 'stats' | 'leaderboard' | 'activity';
  theme?: 'light' | 'dark' | 'auto';
  size?: 'small' | 'medium' | 'large';
  showTitle?: boolean;
  showLogo?: boolean;
  customColors?: { primary?: string; background?: string; text?: string };
}

export interface WidgetResponseDto {
  id: string;
  guildId: string;
  name: string;
  config: Record<string, unknown>;
  embedUrl: string;
  embedCode: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class WidgetsService {
  constructor(
    @InjectRepository(Widget)
    private readonly widgetRepository: Repository<Widget>,
    private readonly guildsService: GuildsService,
  ) {}

  private toResponse(w: Widget): WidgetResponseDto {
    return {
      id: w.id,
      guildId: w.guildId,
      name: w.name,
      config: (w.config ?? {}) as Record<string, unknown>,
      embedUrl: w.embedUrl,
      embedCode: w.embedCode,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    };
  }

  async getWidgetsByGuild(discordGuildId: string): Promise<WidgetResponseDto[]> {
    const guild = await this.guildsService.findGuildByDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const widgets = await this.widgetRepository.find({
      where: { guildId: guild.id },
      order: { createdAt: 'DESC' },
    });
    return widgets.map((w) => this.toResponse(w));
  }

  async getWidgetById(widgetId: string): Promise<WidgetResponseDto> {
    const widget = await this.widgetRepository.findOne({
      where: { id: widgetId },
    });
    if (!widget) {
      throw new NotFoundException({
        code: 'WIDGET_NOT_FOUND',
        message: 'Widget not found',
      });
    }
    return this.toResponse(widget);
  }

  async createWidget(
    discordGuildId: string,
    name: string,
    config: WidgetConfigDto | Record<string, unknown>,
  ): Promise<WidgetResponseDto> {
    const guild = await this.guildsService.findGuildByDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const baseUrl = process.env.FRONTEND_API_URL ?? 'https://api.example.com';
    const embedUrl = `${baseUrl}/widgets/embed/${guild.discordGuildId}`;
    const embedCode = `<iframe src="${embedUrl}" width="400" height="200"></iframe>`;
    const now = new Date();
    const widget = this.widgetRepository.create({
      guildId: guild.id,
      name,
      config: (config ?? {}) as Record<string, unknown>,
      embedUrl,
      embedCode,
      createdAt: now,
      updatedAt: now,
    });
    const saved = await this.widgetRepository.save(widget);
    return this.toResponse(saved);
  }

  async updateWidget(
    discordGuildId: string,
    widgetId: string,
    name?: string,
    config?: WidgetConfigDto | Record<string, unknown>,
  ): Promise<WidgetResponseDto> {
    const guild = await this.guildsService.findGuildByDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const widget = await this.widgetRepository.findOne({
      where: { id: widgetId, guildId: guild.id },
    });
    if (!widget) {
      throw new NotFoundException({
        code: 'WIDGET_NOT_FOUND',
        message: 'Widget not found',
      });
    }
    if (name !== undefined) widget.name = name;
    if (config !== undefined)
      widget.config = (config ?? {}) as Record<string, unknown>;
    await this.widgetRepository.save(widget);
    return this.toResponse(widget);
  }

  async deleteWidget(
    discordGuildId: string,
    widgetId: string,
  ): Promise<{ success: true }> {
    const guild = await this.guildsService.findGuildByDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const widget = await this.widgetRepository.findOne({
      where: { id: widgetId, guildId: guild.id },
    });
    if (!widget) {
      throw new NotFoundException({
        code: 'WIDGET_NOT_FOUND',
        message: 'Widget not found',
      });
    }
    await this.widgetRepository.remove(widget);
    return { success: true };
  }
}
