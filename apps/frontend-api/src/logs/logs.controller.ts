import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GuildAdminGuard } from '../guilds/guards/guild-admin.guard';
import { GuildIdParamDto } from '../guilds/dto/guild-id-param.dto';
import { LogsService } from './logs.service';
import type {
  LogSettingResponseDto,
  LogEventResponseDto,
} from './logs.service';
import { PatchLogSettingsDto } from './dto';

@Controller('guilds/:guildId/logs')
@UseGuards(JwtAuthGuard, GuildAdminGuard)
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get('settings')
  async getSettings(
    @Param() params: GuildIdParamDto,
  ): Promise<{ data: LogSettingResponseDto[] }> {
    const data = await this.logsService.getSettings(params.guildId);
    return { data };
  }

  @Patch('settings')
  async patchSettings(
    @Param() params: GuildIdParamDto,
    @Body() dto: PatchLogSettingsDto,
  ): Promise<{ data: LogSettingResponseDto[] }> {
    const data = await this.logsService.patchSettings(params.guildId, dto);
    return { data };
  }

  @Get('events')
  async getEvents(
    @Param() _params: GuildIdParamDto,
  ): Promise<{ data: LogEventResponseDto[] }> {
    const data = this.logsService.getEvents();
    return { data };
  }
}
