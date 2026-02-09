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
import { WelcomeGoodbyeService } from './welcome-goodbye.service';
import type { WelcomeGoodbyeSettingResponseDto } from './welcome-goodbye.service';
import { PatchWelcomeGoodbyeDto } from './dto';

@ApiTags('Welcome / Goodbye')
@ApiBearerAuth()
@Controller('guilds/:guildId')
@UseGuards(JwtAuthGuard, GuildAdminGuard)
export class WelcomeGoodbyeController {
  constructor(private readonly welcomeGoodbyeService: WelcomeGoodbyeService) {}

  @Get('welcome')
  @ApiOperation({
    summary: 'Get welcome message settings',
    description: 'Returns welcome message settings (channelId, enabled, messageType, contentText, contentEmbed). Bearer JWT, guild admin.',
  })
  async getWelcome(
    @Param() params: GuildIdParamDto,
  ): Promise<{ data: WelcomeGoodbyeSettingResponseDto }> {
    const data = await this.welcomeGoodbyeService.getWelcome(params.guildId);
    return { data };
  }

  @Patch('welcome')
  @ApiOperation({
    summary: 'Update welcome message settings',
    description: 'Updates welcome message settings. Body: channelId?, enabled?, messageType?, contentText?, contentEmbed?. Returns updated settings. Bearer JWT, guild admin.',
  })
  async patchWelcome(
    @Param() params: GuildIdParamDto,
    @Body() dto: PatchWelcomeGoodbyeDto,
  ): Promise<{ data: WelcomeGoodbyeSettingResponseDto }> {
    const data = await this.welcomeGoodbyeService.patchWelcome(params.guildId, dto);
    return { data };
  }

  @Get('goodbye')
  @ApiOperation({
    summary: 'Get goodbye message settings',
    description: 'Returns goodbye message settings (channelId, enabled, messageType, contentText, contentEmbed). Bearer JWT, guild admin.',
  })
  async getGoodbye(
    @Param() params: GuildIdParamDto,
  ): Promise<{ data: WelcomeGoodbyeSettingResponseDto }> {
    const data = await this.welcomeGoodbyeService.getGoodbye(params.guildId);
    return { data };
  }

  @Patch('goodbye')
  @ApiOperation({
    summary: 'Update goodbye message settings',
    description: 'Updates goodbye message settings. Body: channelId?, enabled?, messageType?, contentText?, contentEmbed?. Returns updated settings. Bearer JWT, guild admin.',
  })
  async patchGoodbye(
    @Param() params: GuildIdParamDto,
    @Body() dto: PatchWelcomeGoodbyeDto,
  ): Promise<{ data: WelcomeGoodbyeSettingResponseDto }> {
    const data = await this.welcomeGoodbyeService.patchGoodbye(params.guildId, dto);
    return { data };
  }
}
