import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guild, Counter, Widget } from '@app/shared';

@Injectable()
export class GuildsService {
  constructor(
    @InjectRepository(Guild)
    private readonly guildRepository: Repository<Guild>,
    @InjectRepository(Counter)
    private readonly counterRepository: Repository<Counter>,
    @InjectRepository(Widget)
    private readonly widgetRepository: Repository<Widget>,
  ) {}

  async getGuilds(
    page: number,
    limit: number,
    search?: string,
    minMembers?: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
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
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const qb = this.guildRepository.createQueryBuilder('g');
    if (search && search.trim()) {
      qb.andWhere(
        '(g.name ILIKE :search OR g.discord_guild_id::text ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }
    if (minMembers != null && minMembers > 0) {
      qb.andWhere('g.member_count >= :minMembers', { minMembers });
    }
    const orderBy =
      sortBy === 'memberCount' ? 'g.member_count' : 'g.created_at';
    qb.orderBy(orderBy, sortOrder === 'asc' ? 'ASC' : 'DESC');
    const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
    const take = Math.min(100, Math.max(1, limit));
    const [guilds, total] = await qb.skip(skip).take(take).getManyAndCount();
    const data = await Promise.all(
      guilds.map(async (g) => {
        const [activeCountersCount, widgetsCreatedCount] = await Promise.all([
          this.counterRepository.count({
            where: { guildId: g.id, status: 'active' as never },
          }),
          this.widgetRepository.count({ where: { guildId: g.id } }),
        ]);
        return {
          id: g.id,
          discordGuildId: g.discordGuildId,
          name: g.name,
          iconUrl: g.iconUrl,
          ownerId: g.ownerId,
          memberCount: g.memberCount,
          shardId: g.shardId,
          isBotInGuild: g.isBotInGuild,
          activeCountersCount,
          widgetsCreatedCount,
          joinedAt: g.createdAt.toISOString(),
          historySyncStatus: g.historySyncStatus,
        };
      }),
    );
    const totalPages = Math.ceil(total / take) || 1;
    return {
      data,
      meta: { total, page: Math.max(1, page), limit: take, totalPages },
    };
  }

  async getGuildById(guildId: string): Promise<{
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
  }> {
    const guild = await this.guildRepository.findOne({
      where: { id: guildId },
    });
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: `Guild with id '${guildId}' not found`,
      });
    }
    const [activeCountersCount, widgetsCreatedCount] = await Promise.all([
      this.counterRepository.count({
        where: { guildId: guild.id, status: 'active' as never },
      }),
      this.widgetRepository.count({ where: { guildId: guild.id } }),
    ]);
    return {
      id: guild.id,
      discordGuildId: guild.discordGuildId,
      name: guild.name,
      iconUrl: guild.iconUrl,
      ownerId: guild.ownerId,
      memberCount: guild.memberCount,
      shardId: guild.shardId,
      isBotInGuild: guild.isBotInGuild,
      activeCountersCount,
      widgetsCreatedCount,
      joinedAt: guild.createdAt.toISOString(),
      historySyncStatus: guild.historySyncStatus,
      config: {},
      stats: { messageActivity: [], ticketVolume: [] },
      isPremium: false,
      isVerified: false,
    };
  }

  async forceLeaveGuild(guildId: string): Promise<{ success: true }> {
    const guild = await this.guildRepository.findOne({
      where: { id: guildId },
    });
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found',
      });
    }
    if (!guild.isBotInGuild) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Bot is already not in guild',
      });
    }
    guild.isBotInGuild = false;
    await this.guildRepository.save(guild);
    return { success: true };
  }
}
