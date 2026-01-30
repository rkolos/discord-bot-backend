import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Counter, CounterStatus, CounterType, previewCounterTemplate } from '@app/shared';
import { GuildsService } from '../guilds/guilds.service';
import { CountersQueueService } from './counters-queue.service';
import type { CreateCounterDto } from './dto/create-counter.dto';
import type { PatchCounterDto } from './dto/patch-counter.dto';

export interface CounterResponseDto {
  id: string;
  channelId: string;
  channelName: string;
  type: CounterType;
  metric: string | null;
  template: string;
  status: CounterStatus;
  currentValue: number | null;
  target: number | null;
  timezone: string | null;
  dateFormat: string | null;
  createdAt: string;
  updatedAt: string;
}

function toCounterResponseDto(c: Counter): CounterResponseDto {
  return {
    id: c.id,
    channelId: c.channelId,
    channelName: c.channelName,
    type: c.type,
    metric: c.metric,
    template: c.template,
    status: c.status,
    currentValue: c.currentValue != null ? Number(c.currentValue) : null,
    target: c.target != null ? Number(c.target) : null,
    timezone: c.timezone,
    dateFormat: c.dateFormat,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

@Injectable()
export class CountersService {
  constructor(
    @InjectRepository(Counter)
    private readonly counterRepository: Repository<Counter>,
    private readonly guildsService: GuildsService,
    private readonly countersQueueService: CountersQueueService,
  ) {}

  async create(
    discordGuildId: string,
    dto: CreateCounterDto,
  ): Promise<CounterResponseDto> {
    const guild = await this.guildsService.findGuildByDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const channelName = previewCounterTemplate(dto.template);
    const counter = this.counterRepository.create({
      guildId: guild.id,
      channelId: dto.channelId,
      channelName,
      type: dto.type,
      metric: dto.metric ?? null,
      template: dto.template,
      status: CounterStatus.ACTIVE,
      currentValue: null,
      target: dto.target != null ? String(dto.target) : null,
      timezone: dto.timezone ?? null,
      dateFormat: dto.dateFormat ?? null,
      updatedAt: new Date(),
    });
    const saved = await this.counterRepository.save(counter);
    await this.countersQueueService.addCounterUpdate(saved).catch(() => {});
    return toCounterResponseDto(saved);
  }

  async findAllByGuild(discordGuildId: string): Promise<CounterResponseDto[]> {
    const guild = await this.guildsService.findGuildByDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const counters = await this.counterRepository.find({
      where: { guildId: guild.id },
      order: { createdAt: 'ASC' },
    });
    return counters.map(toCounterResponseDto);
  }

  async update(
    discordGuildId: string,
    counterId: string,
    dto: PatchCounterDto,
  ): Promise<CounterResponseDto> {
    const guild = await this.guildsService.findGuildByDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const counter = await this.counterRepository.findOne({
      where: { id: counterId, guildId: guild.id },
    });
    if (!counter) {
      throw new NotFoundException({
        code: 'COUNTER_NOT_FOUND',
        message: 'Counter not found',
      });
    }
    if (dto.channelId != null) counter.channelId = dto.channelId;
    if (dto.type != null) counter.type = dto.type;
    if (dto.metric !== undefined) counter.metric = dto.metric ?? null;
    if (dto.template != null) {
      counter.template = dto.template;
      counter.channelName = previewCounterTemplate(dto.template);
    }
    if (dto.status != null) counter.status = dto.status;
    if (dto.target !== undefined)
      counter.target = dto.target != null ? String(dto.target) : null;
    if (dto.timezone !== undefined) counter.timezone = dto.timezone ?? null;
    if (dto.dateFormat !== undefined)
      counter.dateFormat = dto.dateFormat ?? null;
    counter.updatedAt = new Date();
    const saved = await this.counterRepository.save(counter);
    await this.countersQueueService.addCounterUpdate(saved).catch(() => {});
    return toCounterResponseDto(saved);
  }

  async remove(
    discordGuildId: string,
    counterId: string,
  ): Promise<{ success: true }> {
    const guild = await this.guildsService.findGuildByDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const counter = await this.counterRepository.findOne({
      where: { id: counterId, guildId: guild.id },
    });
    if (!counter) {
      throw new NotFoundException({
        code: 'COUNTER_NOT_FOUND',
        message: 'Counter not found',
      });
    }
    await this.countersQueueService
      .addCounterDelete(counter.id, counter.guildId, counter.channelId)
      .catch(() => {});
    await this.counterRepository.remove(counter);
    return { success: true };
  }

  /**
   * Возвращает превью строки шаблона с подставленными примерами значений
   * (например Members: 1,234). Результат обрезается до COUNTER_TEMPLATE_MAX_LENGTH.
   */
  previewTemplate(template: string): string {
    return previewCounterTemplate(template);
  }
}
