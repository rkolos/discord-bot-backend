import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Guild, CompanyMember } from '@app/shared';
import { RedisService } from '@app/shared';
import { DiscordOAuthService } from '../auth/discord-oauth.service';
import { UserGuildDto } from './dto/user-guild.dto';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const GUILDS_CACHE_KEY_PREFIX = 'guilds:cache:';
const GUILDS_CACHE_TTL_SECONDS = 300; // 5 min

/** Administrator = 0x8, Manage Guild = 0x20 */
const REQUIRED_PERMISSION_BITS = 0x8 | 0x20;

interface DiscordPartialGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

function hasManageOrAdmin(permissionsStr: string): boolean {
  const perm = BigInt(permissionsStr);
  const required = BigInt(REQUIRED_PERMISSION_BITS);
  return (perm & required) !== BigInt(0);
}

@Injectable()
export class GuildsRealtimeService {
  constructor(
    private readonly discordOAuth: DiscordOAuthService,
    private readonly httpService: HttpService,
    private readonly redis: RedisService,
    @InjectRepository(Guild)
    private readonly guildRepository: Repository<Guild>,
    @InjectRepository(CompanyMember)
    private readonly companyMemberRepository: Repository<CompanyMember>,
  ) {}

  async getUserGuilds(userId: string): Promise<UserGuildDto[]> {
    const accessToken = await this.discordOAuth.getDiscordToken(userId);
    if (!accessToken) {
      throw new UnauthorizedException({
        code: 'DISCORD_TOKEN_EXPIRED',
        message: 'Re-login required to refresh guild list',
      });
    }

    const cacheKey = GUILDS_CACHE_KEY_PREFIX + userId;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as UserGuildDto[];
    }

    let discordGuilds: DiscordPartialGuild[];
    try {
      const response = await firstValueFrom(
        this.httpService.get<DiscordPartialGuild[]>(
          `${DISCORD_API_BASE}/users/@me/guilds`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        ),
      );
      discordGuilds = response.data ?? [];
    } catch {
      throw new HttpException(
        {
          code: 'OAUTH_FAILED',
          message: 'Discord OAuth authentication failed',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const filtered = discordGuilds.filter((g) =>
      hasManageOrAdmin(g.permissions),
    );
    if (filtered.length === 0) {
      const result: UserGuildDto[] = [];
      await this.redis.set(cacheKey, JSON.stringify(result), GUILDS_CACHE_TTL_SECONDS);
      return result;
    }

    const discordIds = filtered.map((g) => g.id);
    const existingGuilds = await this.guildRepository.find({
      where: { discordGuildId: In(discordIds) },
      select: ['discordGuildId'],
    });
    const existingSet = new Set(
      existingGuilds.map((g) => g.discordGuildId),
    );

    const result: UserGuildDto[] = filtered.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon ?? '',
      owner: g.owner,
      permissions: g.permissions,
      isBotAdded: existingSet.has(g.id),
    }));

    await this.redis.set(cacheKey, JSON.stringify(result), GUILDS_CACHE_TTL_SECONDS);
    return result;
  }

  async userHasGuildAdmin(userId: string, discordGuildId: string): Promise<boolean> {
    const guild = await this.findGuildByDiscordId(discordGuildId);
    if (!guild) return false;
    if (guild.ownerId === userId) return true;
    const guilds = await this.getUserGuilds(userId);
    const g = guilds.find((x) => x.id === discordGuildId);
    return g ? hasManageOrAdmin(g.permissions) : false;
  }

  async findGuildByIdOrDiscordId(guildIdOrDiscordId: string | number): Promise<Guild | null> {
    const id = typeof guildIdOrDiscordId === 'string' ? guildIdOrDiscordId : String(guildIdOrDiscordId);
    if (GuildsRealtimeService.isUuid(id)) {
      return this.guildRepository.findOne({ where: { id } });
    }
    return this.guildRepository.findOne({ where: { discordGuildId: id } });
  }

  async findGuildByDiscordId(discordGuildId: string): Promise<Guild | null> {
    return this.guildRepository.findOne({
      where: { discordGuildId },
    });
  }

  /** UUID (guild.id) или Discord Snowflake (discord_guild_id). */
  private static isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }
}
