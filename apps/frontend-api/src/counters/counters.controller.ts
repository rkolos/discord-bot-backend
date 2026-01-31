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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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

@ApiTags('Counters')
@ApiBearerAuth()
@Controller('guilds/:guildId/counters')
@UseGuards(JwtAuthGuard, GuildAdminGuard)
export class CountersController {
  constructor(private readonly countersService: CountersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create counter',
    description:
      'Creates a new counter (channel, metric, template). Body: channelId, type, template, metric. Returns created counter. Bearer JWT, guild admin.',
  })
  async create(
    @Param() params: GuildIdParamDto,
    @Body() dto: CreateCounterDto,
  ): Promise<{ data: CounterResponseDto }> {
    const data = await this.countersService.create(params.guildId, dto);
    return { data };
  }

  @Get()
  @ApiOperation({
    summary: 'List counters',
    description:
      'Returns all counters for the guild (id, channelId, channelName, type, metric, template, status). Bearer JWT, guild admin.',
  })
  async findAll(
    @Param() params: GuildIdParamDto,
  ): Promise<{ data: CounterResponseDto[] }> {
    const data = await this.countersService.findAllByGuild(params.guildId);
    return { data };
  }

  @Post('preview')
  @ApiOperation({
    summary: 'Preview counter template',
    description:
      'Returns preview text for a template (e.g. "Members: 1,234"). Body: template. Use before creating counter. Bearer JWT, guild admin.',
  })
  async preview(
    @Param() params: GuildIdParamDto,
    @Body() dto: PreviewCounterDto,
  ): Promise<{ data: { preview: string } }> {
    const preview = this.countersService.previewTemplate(dto.template);
    return { data: { preview } };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update counter',
    description:
      'Updates counter (template, metric, etc.). Body: partial. Returns updated counter. Bearer JWT, guild admin.',
  })
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
  @ApiOperation({
    summary: 'Delete counter',
    description:
      'Removes a counter. Bearer JWT, guild admin.',
  })
  async remove(
    @Param() params: GuildAndCounterIdParamDto,
  ): Promise<{ data: { success: true } }> {
    const data = await this.countersService.remove(params.guildId, params.id);
    return { data };
  }
}
