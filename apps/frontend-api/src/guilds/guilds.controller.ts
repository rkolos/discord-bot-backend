import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
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

@Controller('guilds')
export class GuildsController {
  constructor(private readonly guildsService: GuildsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getGuilds(@CurrentUser() user: User): Promise<{ data: UserGuildDto[] }> {
    const data = await this.guildsService.getUserGuilds(user.id);
    return { data };
  }

  @Post('onboard')
  @UseGuards(JwtAuthGuard)
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
  async getSettings(
    @Param() params: GuildIdParamDto,
  ): Promise<{ data: GuildSettingsResponseDto }> {
    const data = await this.guildsService.getSettings(params.guildId);
    return { data };
  }

  @Patch(':guildId/settings')
  @UseGuards(JwtAuthGuard, GuildAdminGuard)
  async updateSettings(
    @Param() params: GuildIdParamDto,
    @Body() dto: PatchSettingsDto,
  ): Promise<{ data: GuildSettingsResponseDto }> {
    const data = await this.guildsService.updateSettings(params.guildId, dto);
    return { data };
  }

  @Patch(':guildId/modules')
  @UseGuards(JwtAuthGuard, GuildAdminGuard)
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
  async updateToken(
    @Param() params: GuildIdParamDto,
    @Body() dto: PatchGuildTokenDto,
  ): Promise<{ data: { botToken: string | null } }> {
    const data = await this.guildsService.updateToken(params.guildId, dto);
    return { data };
  }

  @Get(':guildId/channels')
  @UseGuards(JwtAuthGuard, GuildAdminGuard)
  async getChannels(
    @Param() params: GuildIdParamDto,
  ): Promise<{ data: GuildChannelDto[] }> {
    const data = await this.guildsService.getChannelsForGuild(params.guildId);
    return { data };
  }

  @Get(':guildId/stats')
  @UseGuards(JwtAuthGuard, GuildAdminGuard)
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
  async getActivitySparkline(
    @Param() params: GuildIdParamDto,
  ): Promise<{ data: number[] }> {
    const data = await this.guildsService.getActivitySparkline(params.guildId);
    return { data };
  }
}
