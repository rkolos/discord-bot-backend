import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GuildsService } from './guilds.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@app/shared';
import { UserGuildDto } from './dto/user-guild.dto';
import { OnboardGuildDto } from './dto/onboard-guild.dto';
import { GuildIdParamDto } from './dto/guild-id-param.dto';
import { PatchGuildModulesDto } from './dto/patch-guild-modules.dto';
import { PatchGuildTokenDto } from './dto/patch-guild-token.dto';
import { PatchSettingsDto } from './dto/patch-settings.dto';
import { GuildAdminGuard } from './guards/guild-admin.guard';
import type { GuildSettingsResponseDto, GuildChannelDto } from './guilds.service';

@ApiTags('Guilds')
@ApiBearerAuth()
@Controller('guilds')
export class GuildsController {
  constructor(private readonly guildsService: GuildsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'List my guilds',
    description:
      'Returns all Discord servers the user has access to (id, name, status, memberCount, etc.). Use for server list. Requires Bearer JWT.',
  })
  async getGuilds(@CurrentUser() user: User): Promise<{ data: UserGuildDto[] }> {
    const data = await this.guildsService.getUserGuilds(user.id);
    return { data };
  }

  @Post('onboard')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Onboard a Discord server',
    description:
      'Links a Discord server to the platform. Body: discordGuildId, name. Returns guildId. Requires Bearer JWT.',
  })
  async onboardGuild(
    @CurrentUser() user: User,
    @Body() dto: OnboardGuildDto,
  ): Promise<{ data: { guildId: string } }> {
    const { guildId } = await this.guildsService.onboardGuild(
      dto.discordGuildId,
      user.id,
      dto.name,
    );
    return { data: { guildId } };
  }

  @Get(':guildId/settings')
  @UseGuards(JwtAuthGuard, GuildAdminGuard)
  @ApiOperation({
    summary: 'Get guild settings',
    description:
      'Returns guild settings (serverName, language, timezone, bot status, modules). Requires guild admin. Bearer JWT.',
  })
  async getSettings(
    @Param() params: GuildIdParamDto,
  ): Promise<{ data: GuildSettingsResponseDto }> {
    const data = await this.guildsService.getSettings(params.guildId);
    return { data };
  }

  @Patch(':guildId/settings')
  @UseGuards(JwtAuthGuard, GuildAdminGuard)
  @ApiOperation({
    summary: 'Update guild settings',
    description:
      'Partially updates guild settings (serverName, serverDescription, language, timezone, dataRetentionDays, etc.). Bearer JWT, guild admin.',
  })
  async updateSettings(
    @Param() params: GuildIdParamDto,
    @Body() dto: PatchSettingsDto,
  ): Promise<{ data: GuildSettingsResponseDto }> {
    const data = await this.guildsService.updateSettings(params.guildId, dto);
    return { data };
  }

  @Patch(':guildId/modules')
  @UseGuards(JwtAuthGuard, GuildAdminGuard)
  @ApiOperation({
    summary: 'Update guild modules',
    description:
      'Enables or disables modules (e.g. counters). Body: counters, etc. Returns updated modules list. Bearer JWT, guild admin.',
  })
  async updateModules(
    @Param() params: GuildIdParamDto,
    @Body() dto: PatchGuildModulesDto,
  ): Promise<{
    data: GuildSettingsResponseDto['modules'];
  }> {
    const data = await this.guildsService.updateModules(params.guildId, dto);
    return { data };
  }

  @Patch(':guildId/token')
  @UseGuards(JwtAuthGuard, GuildAdminGuard)
  @ApiOperation({
    summary: 'Update bot token',
    description:
      'Sets or updates the Discord bot token for the guild (encrypted). Body: botToken. Bearer JWT, guild admin.',
  })
  async updateToken(
    @Param() params: GuildIdParamDto,
    @Body() dto: PatchGuildTokenDto,
  ): Promise<{ data: { botToken: string | null } }> {
    const data = await this.guildsService.updateToken(params.guildId, dto);
    return { data };
  }

  @Get(':guildId/channels')
  @UseGuards(JwtAuthGuard, GuildAdminGuard)
  @ApiOperation({
    summary: 'List guild channels',
    description:
      'Returns Discord channels for the guild (id, name, type). Use for channel picker (counters, logs). Bearer JWT, guild admin.',
  })
  async getChannels(
    @Param() params: GuildIdParamDto,
  ): Promise<{ data: GuildChannelDto[] }> {
    const data = await this.guildsService.getChannelsForGuild(params.guildId);
    return { data };
  }

  @Get(':guildId/stats')
  @UseGuards(JwtAuthGuard, GuildAdminGuard)
  @ApiOperation({
    summary: 'Get guild stats',
    description:
      'Returns aggregate stats: totalMembers, totalMessages, activeMembers, voiceMinutes. Bearer JWT, guild admin.',
  })
  async getStats(
    @Param() params: GuildIdParamDto,
  ): Promise<{
    data: {
      totalMembers: number;
      totalMessages: number;
      activeMembers: number;
      voiceMinutes: number;
    };
  }> {
    const data = await this.guildsService.getGuildStats(params.guildId);
    return { data };
  }

  @Get(':guildId/bot-status')
  @UseGuards(JwtAuthGuard, GuildAdminGuard)
  @ApiOperation({
    summary: 'Get bot status',
    description:
      'Returns bot status (online/offline), lastSeen, version. Bearer JWT, guild admin.',
  })
  async getBotStatus(
    @Param() params: GuildIdParamDto,
  ): Promise<{
    data: { status: string; lastSeen: string | null; version: string };
  }> {
    const data = await this.guildsService.getBotStatus(params.guildId);
    return { data };
  }

  @Get(':guildId/modules')
  @UseGuards(JwtAuthGuard, GuildAdminGuard)
  @ApiOperation({
    summary: 'List guild modules',
    description:
      'Returns enabled modules (id, name, enabled, hasError). Bearer JWT, guild admin.',
  })
  async getModules(
    @Param() params: GuildIdParamDto,
  ): Promise<{
    data: Array<{ id: string; name: string; enabled: boolean; hasError: boolean }>;
  }> {
    const data = await this.guildsService.getModules(params.guildId);
    return { data };
  }

  @Get(':guildId/activity-sparkline')
  @UseGuards(JwtAuthGuard, GuildAdminGuard)
  @ApiOperation({
    summary: 'Get activity sparkline',
    description:
      'Returns time-series data (array of numbers) for activity chart. Bearer JWT, guild admin.',
  })
  async getActivitySparkline(
    @Param() params: GuildIdParamDto,
  ): Promise<{ data: number[] }> {
    const data = await this.guildsService.getActivitySparkline(params.guildId);
    return { data };
  }
}
