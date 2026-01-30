import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GuildAdminGuard } from '../guilds/guards/guild-admin.guard';
import { GuildIdParamDto } from '../guilds/dto/guild-id-param.dto';
import { CountersService } from './counters.service';
import type { CounterResponseDto } from './counters.service';
import {
  CreateCounterDto,
  PatchCounterDto,
  PreviewCounterDto,
  GuildAndCounterIdParamDto,
} from './dto';

@Controller('guilds/:guildId/counters')
@UseGuards(JwtAuthGuard, GuildAdminGuard)
export class CountersController {
  constructor(private readonly countersService: CountersService) {}

  @Post()
  async create(
    @Param() params: GuildIdParamDto,
    @Body() dto: CreateCounterDto,
  ): Promise<{ data: CounterResponseDto }> {
    const data = await this.countersService.create(params.guildId, dto);
    return { data };
  }

  @Get()
  async findAll(
    @Param() params: GuildIdParamDto,
  ): Promise<{ data: CounterResponseDto[] }> {
    const data = await this.countersService.findAllByGuild(params.guildId);
    return { data };
  }

  @Post('preview')
  async preview(
    @Param() params: GuildIdParamDto,
    @Body() dto: PreviewCounterDto,
  ): Promise<{ data: { preview: string } }> {
    const preview = this.countersService.previewTemplate(dto.template);
    return { data: { preview } };
  }

  @Patch(':id')
  async update(
    @Param() params: GuildAndCounterIdParamDto,
    @Body() dto: PatchCounterDto,
  ): Promise<{ data: CounterResponseDto }> {
    const data = await this.countersService.update(
      params.guildId,
      params.id,
      dto,
    );
    return { data };
  }

  @Delete(':id')
  async remove(
    @Param() params: GuildAndCounterIdParamDto,
  ): Promise<{ data: { success: true } }> {
    const data = await this.countersService.remove(params.guildId, params.id);
    return { data };
  }
}
