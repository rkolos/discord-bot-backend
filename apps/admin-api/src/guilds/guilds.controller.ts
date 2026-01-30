import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { GuildsService } from './guilds.service';
import { GuildsQueryDto } from './dto/guilds-query.dto';
import { GuildIdParamDto } from './dto/guild-id-param.dto';

@Controller('guilds')
@UseGuards(AdminAuthGuard)
export class GuildsController {
  constructor(private readonly guildsService: GuildsService) {}

  @Get()
  async getGuilds(
    @Query() query: GuildsQueryDto,
  ): Promise<{
    data: Array<{
      id: string;
      discordGuildId: string;
      name: string;
      iconUrl: string | null;
      ownerId: string;
      memberCount: number;
      shardId: number | null;
      isBotInGuild: boolean;
      activeCountersCount: number;
      widgetsCreatedCount: number;
      joinedAt: string;
      historySyncStatus: string;
    }>;
    meta: { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean };
  }> {
    return this.guildsService.getGuilds(
      query.page ?? 1,
      query.limit ?? 10,
      query.search,
      query.minMembers,
      query.sortBy,
      query.sortOrder as 'asc' | 'desc',
    );
  }

  @Get(':id')
  async getGuildById(
    @Param() params: GuildIdParamDto,
  ): Promise<{
    data: {
      id: string;
      discordGuildId: string;
      name: string;
      iconUrl: string | null;
      ownerId: string;
      memberCount: number;
      shardId: number | null;
      isBotInGuild: boolean;
      activeCountersCount: number;
      widgetsCreatedCount: number;
      joinedAt: string;
      historySyncStatus: string;
      config: Record<string, unknown>;
      stats: Record<string, unknown>;
      isPremium: boolean;
      isVerified: boolean;
    };
  }> {
    const data = await this.guildsService.getGuildById(params.id);
    return { data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async forceLeaveGuild(
    @Param() params: GuildIdParamDto,
  ): Promise<{ data: { success: true } }> {
    const data = await this.guildsService.forceLeaveGuild(params.id);
    return { data };
  }
}
