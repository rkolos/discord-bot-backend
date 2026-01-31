import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GuildAdminGuard } from '../guilds/guards/guild-admin.guard';
import { GuildIdParamDto } from '../guilds/dto/guild-id-param.dto';
import { LogsService } from './logs.service';
import type {
  LogSettingResponseDto,
  LogEventResponseDto,
} from './logs.service';
import { PatchLogSettingsDto } from './dto';

@ApiTags('Logs')
@ApiBearerAuth()
@Controller('guilds/:guildId/logs')
@UseGuards(JwtAuthGuard, GuildAdminGuard)
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get('settings')
  @ApiOperation({
    summary: 'Get log settings',
    description:
      'Returns log settings per event type (eventType, channelId, enabled). Bearer JWT, guild admin.',
  })
  async getSettings(
    @Param() params: GuildIdParamDto,
  ): Promise<{ data: LogSettingResponseDto[] }> {
    const data = await this.logsService.getSettings(params.guildId);
    return { data };
  }

  @Patch('settings')
  @ApiOperation({
    summary: 'Update log settings',
    description:
      'Updates log channel and enabled per event. Body: settings array. Returns updated settings. Bearer JWT, guild admin.',
  })
  async patchSettings(
    @Param() params: GuildIdParamDto,
    @Body() dto: PatchLogSettingsDto,
  ): Promise<{ data: LogSettingResponseDto[] }> {
    const data = await this.logsService.patchSettings(params.guildId, dto);
    return { data };
  }

  @Get('events')
  @ApiOperation({
    summary: 'List log event types',
    description:
      'Returns available log event types (id, name, description). Use for log config UI. Bearer JWT, guild admin.',
  })
  async getEvents(
    @Param() _params: GuildIdParamDto,
  ): Promise<{ data: LogEventResponseDto[] }> {
    const data = this.logsService.getEvents();
    return { data };
  }
}
