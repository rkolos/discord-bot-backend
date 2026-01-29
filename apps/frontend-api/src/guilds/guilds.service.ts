import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  Guild,
  GuildModule,
  GuildStatus,
  GuildSubscriptionTier,
  ServerSettings,
} from '@app/shared';
import { CryptoService, RedisService } from '@app/shared';
import { SharedConfigService } from '@app/shared';
import { DiscordOAuthService } from '../auth/discord-oauth.service';
import { UserGuildDto } from './dto/user-guild.dto';
import {
  ALLOWED_MODULE_KEYS,
  GUILD_SETTINGS_CHANGED_CHANNEL_SUFFIX,
  MODULE_DISPLAY_NAMES,
} from './constants';
import type { AllowedModuleKey } from './constants';
import type { PatchGuildModulesDto } from './dto/patch-guild-modules.dto';
import type { PatchGuildTokenDto } from './dto/patch-guild-token.dto';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const GUILDS_CACHE_KEY_PREFIX = 'guilds:cache:';
const GUILDS_CACHE_TTL_SECONDS = 300; // 5 min

/** Administrator = 0x8, Manage Guild = 0x20 */
const REQUIRED_PERMISSION_BITS = 0x8 | 0x20;

export interface DiscordPartialGuild {
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

const DEFAULT_GUILD_NAME = 'Server';
const DEFAULT_LANGUAGE = 'en';

const BOT_TOKEN_MASK = '********';

export interface GuildSettingsResponseDto {
  serverName: string;
  serverDescription: string | null;
  language: string;
  timezone: string;
  /** true, если в БД сохранён зашифрованный токен бота; реальный токен не передаётся. */
  hasToken: boolean;
  botConnected: boolean;
  botUserId: string | null;
  lastConnected: string | null;
  dataRetentionDays: number;
  anonymizeUserData: boolean;
  shareAnalytics: boolean;
  allowPublicWidgets: boolean;
  modules: Array<{ id: string; name: string; enabled: boolean; hasError: boolean }>;
}

@Injectable()
export class GuildsService {
  constructor(
    private readonly discordOAuth: DiscordOAuthService,
    private readonly httpService: HttpService,
    private readonly redis: RedisService,
    private readonly crypto: CryptoService,
    private readonly sharedConfig: SharedConfigService,
    @InjectRepository(Guild)
    private readonly guildRepository: Repository<Guild>,
    @InjectRepository(ServerSettings)
    private readonly serverSettingsRepository: Repository<ServerSettings>,
    @InjectRepository(GuildModule)
    private readonly guildModuleRepository: Repository<GuildModule>,
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

  /**
   * Проверяет, есть ли у пользователя права администратора/управления гильдией в Discord (по кэшу или Discord API).
   * Используется GuildAdminGuard для защиты эндпоинтов настроек гильдии.
   */
  async userHasGuildAdmin(userId: string, discordGuildId: string): Promise<boolean> {
    const guilds = await this.getUserGuilds(userId);
    const guild = guilds.find((g) => g.id === discordGuildId);
    if (!guild) return false;
    return hasManageOrAdmin(guild.permissions);
  }

  async findGuildByDiscordId(discordGuildId: string): Promise<Guild | null> {
    return this.guildRepository.findOne({
      where: { discordGuildId },
    });
  }

  /**
   * Возвращает настройки гильдии и модули. Реальный токен не передаётся; в ответе только hasToken.
   */
  async getSettings(discordGuildId: string): Promise<GuildSettingsResponseDto> {
    const guild = await this.findGuildByDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const settings = await this.serverSettingsRepository.findOne({
      where: { guildId: guild.id },
    });
    if (!settings) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const modules = await this.guildModuleRepository.find({
      where: { guildId: guild.id },
    });
    const hasToken =
      settings.botTokenEncrypted != null && settings.botTokenEncrypted.length > 0;
    return {
      serverName: settings.serverName,
      serverDescription: settings.serverDescription,
      language: settings.language,
      timezone: settings.timezone,
      hasToken,
      botConnected: settings.botConnected,
      botUserId: settings.botUserId,
      lastConnected: settings.lastConnected?.toISOString() ?? null,
      dataRetentionDays: settings.dataRetentionDays,
      anonymizeUserData: settings.anonymizeUserData,
      shareAnalytics: settings.shareAnalytics,
      allowPublicWidgets: settings.allowPublicWidgets,
      modules: modules.map((m) => ({
        id: m.id,
        name:
          (MODULE_DISPLAY_NAMES as Record<string, string>)[m.moduleKey] ?? m.moduleKey,
        enabled: m.enabled,
        hasError: m.hasError,
      })),
    };
  }

  /**
   * Обновляет статусы модулей гильдии. Если модуля нет — создаёт запись с дефолтами.
   * Поддерживает формат { moduleId, enabled } (один модуль) и объект с ключами counters/analytics.
   */
  async updateModules(
    discordGuildId: string,
    dto: PatchGuildModulesDto,
  ): Promise<GuildSettingsResponseDto['modules']> {
    const guild = await this.findGuildByDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const updates: Array<{ moduleKey: AllowedModuleKey; enabled: boolean }> = [];

    if (dto.moduleId != null && dto.moduleId !== '') {
      const moduleKey = dto.moduleId as AllowedModuleKey;
      if (ALLOWED_MODULE_KEYS.includes(moduleKey)) {
        updates.push({ moduleKey, enabled: dto.enabled ?? true });
      }
    } else {
      for (const key of ALLOWED_MODULE_KEYS) {
        const value = (dto as Record<string, unknown>)[key];
        if (typeof value === 'boolean') updates.push({ moduleKey: key, enabled: value });
      }
    }

    if (updates.length === 0) {
      const modules = await this.guildModuleRepository.find({
        where: { guildId: guild.id },
      });
      return modules.map((m) => ({
        id: m.id,
        name:
          (MODULE_DISPLAY_NAMES as Record<string, string>)[m.moduleKey] ?? m.moduleKey,
        enabled: m.enabled,
        hasError: m.hasError,
      }));
    }
    for (const { moduleKey, enabled } of updates) {
      const existing = await this.guildModuleRepository.findOne({
        where: { guildId: guild.id, moduleKey },
      });
      if (existing) {
        existing.enabled = enabled;
        await this.guildModuleRepository.save(existing);
      } else {
        const created = this.guildModuleRepository.create({
          guildId: guild.id,
          moduleKey,
          enabled,
          hasError: false,
        });
        await this.guildModuleRepository.save(created);
      }
    }
    const modules = await this.guildModuleRepository.find({
      where: { guildId: guild.id },
    });
    return modules.map((m) => ({
      id: m.id,
      name:
        (MODULE_DISPLAY_NAMES as Record<string, string>)[m.moduleKey] ?? m.moduleKey,
      enabled: m.enabled,
      hasError: m.hasError,
    }));
  }

  /**
   * Обновляет или очищает токен бота. Шифрует через CryptoService перед сохранением.
   * Публикует событие в Redis для перезагрузки шардов bot-service.
   */
  async updateToken(
    discordGuildId: string,
    dto: PatchGuildTokenDto,
  ): Promise<{ botToken: string | null }> {
    const guild = await this.findGuildByDiscordId(discordGuildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const settings = await this.serverSettingsRepository.findOne({
      where: { guildId: guild.id },
    });
    if (!settings) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    if (dto.botToken !== undefined) {
      if (dto.botToken === '' || dto.botToken == null) {
        settings.botTokenEncrypted = null;
      } else {
        settings.botTokenEncrypted = this.crypto.encrypt(dto.botToken);
      }
      await this.serverSettingsRepository.save(settings);
      const channel =
        this.sharedConfig.redis.prefix + GUILD_SETTINGS_CHANGED_CHANNEL_SUFFIX;
      const payload = JSON.stringify({
        discordGuildId,
        guildId: guild.id,
      });
      await this.redis.getClient().publish(channel, payload);
    }
    const mask =
      settings.botTokenEncrypted != null &&
      settings.botTokenEncrypted.length > 0
        ? BOT_TOKEN_MASK
        : null;
    return { botToken: mask };
  }

  /**
   * Заглушка: первичное создание записи в guilds и server_settings после добавления бота.
   * Вызывается при выборе сервера пользователем (JWT) или из bot-service/worker.
   */
  async onboardGuild(
    discordGuildId: string,
    ownerUserId: string,
    name?: string,
  ): Promise<{ guildId: string }> {
    const existing = await this.guildRepository.findOne({
      where: { discordGuildId },
    });
    if (existing) {
      throw new ConflictException({
        code: 'GUILD_ALREADY_EXISTS',
        message: 'Guild already onboarded',
      });
    }

    const serverName = name ?? DEFAULT_GUILD_NAME;

    const guild = this.guildRepository.create({
      discordGuildId,
      name: serverName,
      iconUrl: null,
      banner: null,
      ownerId: ownerUserId,
      status: GuildStatus.ACTIVE,
      subscriptionTier: GuildSubscriptionTier.FREE,
      memberCount: 0,
      messageCount: '0',
      onlineMembers: null,
      memberGrowth: null,
      lastActivity: null,
      shardId: null,
      isBotInGuild: true,
    });
    const savedGuild = await this.guildRepository.save(guild);

    const settings = this.serverSettingsRepository.create({
      guildId: savedGuild.id,
      serverName,
      serverDescription: null,
      language: DEFAULT_LANGUAGE,
      timezone: 'UTC',
      botTokenEncrypted: null,
      botConnected: false,
      botUserId: null,
      lastConnected: null,
      lastSyncAt: null,
      dataRetentionDays: 0,
      anonymizeUserData: true,
      shareAnalytics: true,
      allowPublicWidgets: true,
    });
    await this.serverSettingsRepository.save(settings);

    return { guildId: savedGuild.id };
  }
}
