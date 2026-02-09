import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  Guild,
  GuildModule,
  GuildStatus,
  GuildSubscriptionTier,
  ServerSettings,
  CompanyMember,
  SharedAnalyticsService,
} from '@app/shared';
import { CryptoService, RedisService } from '@app/shared';
import { SharedConfigService } from '@app/shared';
import { HistorySyncQueueService } from './history-sync-queue.service';
import { GuildContextService } from './guild-context.service';
import { GuildsRealtimeService } from './guilds-realtime.service';
import { UserGuildDto } from './dto/user-guild.dto';
import {
  ALLOWED_MODULE_KEYS,
  GUILD_SETTINGS_CHANGED_CHANNEL_SUFFIX,
  MODULE_DISPLAY_NAMES,
  computeActivityLevel,
} from './constants';
import type { ActivityLevel, AllowedModuleKey } from './constants';
import type { PatchGuildModulesDto } from './dto/patch-guild-modules.dto';
import type { PatchGuildTokenDto } from './dto/patch-guild-token.dto';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
/** Discord channel type: GUILD_TEXT */
const CHANNEL_TYPE_TEXT = 0;
/** Discord channel type: GUILD_VOICE */
const CHANNEL_TYPE_VOICE = 2;

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

export interface GuildChannelDto {
  id: string;
  name: string;
}

export interface GuildChannelWithTypeDto {
  id: string;
  name: string;
  type: 'text' | 'voice';
}

export interface GuildRoleDto {
  id: string;
  name: string;
  color: string;
}

@Injectable()
export class GuildsService {
  private readonly logger = new Logger(GuildsService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly redis: RedisService,
    private readonly crypto: CryptoService,
    private readonly sharedConfig: SharedConfigService,
    private readonly configService: ConfigService,
    @InjectRepository(Guild)
    private readonly guildRepository: Repository<Guild>,
    @InjectRepository(ServerSettings)
    private readonly serverSettingsRepository: Repository<ServerSettings>,
    @InjectRepository(GuildModule)
    private readonly guildModuleRepository: Repository<GuildModule>,
    @InjectRepository(CompanyMember)
    private readonly companyMemberRepository: Repository<CompanyMember>,
    private readonly historySyncQueue: HistorySyncQueueService,
    private readonly sharedAnalytics: SharedAnalyticsService,
    private readonly guildContext: GuildContextService,
    private readonly guildsRealtime: GuildsRealtimeService,
  ) {}

  private throwAnalyticsUnavailable(err: unknown): never {
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw new ServiceUnavailableException({
      code: 'ANALYTICS_UNAVAILABLE',
      message: `Analytics storage (ClickHouse) is temporarily unavailable. ${message}`,
    });
  }

  async getMeGuildsPaginated(
    userId: string,
    page: number,
    limit: number,
    search?: string,
  ): Promise<{
    data: Array<{
      id: string;
      name: string;
      icon: string;
      status: string;
      memberCount: number;
      messageCount: number;
      lastActivity: string | null;
      ownerId: string;
      subscriptionTier: string;
      onlineMembers: number;
      memberGrowth: number;
      banner: string;
    }>;
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
    const take = Math.min(100, Math.max(1, limit));
    const qb = this.guildRepository
      .createQueryBuilder('g')
      .where('g.owner_id = :userId', { userId });
    if (search && search.trim()) {
      qb.andWhere('g.name ILIKE :search', {
        search: `%${search.trim()}%`,
      });
    }
    const [guilds, total] = await qb
      .orderBy('g.name', 'ASC')
      .skip(skip)
      .take(take)
      .getManyAndCount();
    let messagesMap: Map<string, number>;
    try {
      messagesMap = await this.sharedAnalytics.getTotalMessagesByGuildIds(guilds.map((g) => g.id));
    } catch (err) {
      this.throwAnalyticsUnavailable(err);
    }
    const data = guilds.map((g) => ({
      id: g.discordGuildId,
      name: g.name,
      icon: g.iconUrl ?? '',
      status: g.status,
      memberCount: g.memberCount,
      messageCount: messagesMap!.get(g.id) ?? 0,
      lastActivity: g.lastActivity?.toISOString() ?? null,
      ownerId: g.ownerId,
      subscriptionTier: g.subscriptionTier,
      onlineMembers: g.onlineMembers ?? 0,
      memberGrowth: g.memberGrowth ?? 0,
      banner: g.banner ?? '',
    }));
    const totalPages = Math.ceil(total / take) || 1;
    return {
      data,
      meta: { total, page: Math.max(1, page), limit: take, totalPages },
    };
  }

  async getCompanyGuildsPaginated(
    companyId: string,
    userId: string,
    page: number,
    limit: number,
    search?: string,
  ): Promise<{
    data: Array<{
      id: string;
      name: string;
      icon: string;
      status: string;
      memberCount: number;
      messageCount: number;
      lastActivity: string | null;
      ownerId: string;
      subscriptionTier: string;
      onlineMembers: number;
      memberGrowth: number;
      banner: string;
    }>;
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const member = await this.companyMemberRepository.findOne({
      where: { companyId, userId },
    });
    if (!member) {
      throw new NotFoundException({
        code: 'COMPANY_NOT_FOUND',
        message: 'Company not found or access denied',
      });
    }
    const members = await this.companyMemberRepository.find({
      where: { companyId },
      select: ['userId'],
    });
    const userIds = members.map((m) => m.userId);
    if (userIds.length === 0) {
      return {
        data: [],
        meta: { total: 0, page: 1, limit: Math.min(100, Math.max(1, limit)), totalPages: 0 },
      };
    }
    const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
    const take = Math.min(100, Math.max(1, limit));
    const qb = this.guildRepository
      .createQueryBuilder('g')
      .where('g.owner_id IN (:...userIds)', { userIds });
    if (search && search.trim()) {
      qb.andWhere('g.name ILIKE :search', {
        search: `%${search.trim()}%`,
      });
    }
    const [guilds, total] = await qb
      .orderBy('g.name', 'ASC')
      .skip(skip)
      .take(take)
      .getManyAndCount();
    let messagesMap: Map<string, number>;
    try {
      messagesMap = await this.sharedAnalytics.getTotalMessagesByGuildIds(guilds.map((g) => g.id));
    } catch (err) {
      this.throwAnalyticsUnavailable(err);
    }
    const data = guilds.map((g) => ({
      id: g.discordGuildId,
      name: g.name,
      icon: g.iconUrl ?? '',
      status: g.status,
      memberCount: g.memberCount,
      messageCount: messagesMap!.get(g.id) ?? 0,
      lastActivity: g.lastActivity?.toISOString() ?? null,
      ownerId: g.ownerId,
      subscriptionTier: g.subscriptionTier,
      onlineMembers: g.onlineMembers ?? 0,
      memberGrowth: g.memberGrowth ?? 0,
      banner: g.banner ?? '',
    }));
    const totalPages = Math.ceil(total / take) || 1;
    return {
      data,
      meta: { total, page: Math.max(1, page), limit: take, totalPages },
    };
  }

  async getGuildStats(guildIdOrDiscordId: string): Promise<{
    totalMembers: number;
    totalMessages: number;
    activeMembers: number;
    voiceMinutes: number;
  }> {
    const guild = await this.findGuildByIdOrDiscordId(guildIdOrDiscordId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    let totalMessages: number;
    try {
      totalMessages = await this.sharedAnalytics.getTotalMessagesByGuildId(guild.id);
    } catch (err) {
      this.throwAnalyticsUnavailable(err);
    }
    const voiceMinutes = await this.sharedAnalytics.getTotalVoiceMinutesByGuildId(guild.id);
    return {
      totalMembers: guild.memberCount,
      totalMessages: totalMessages!,
      activeMembers: guild.onlineMembers ?? 0,
      voiceMinutes,
    };
  }

  async getBotStatus(guildIdOrDiscordId: string): Promise<{
    status: 'online' | 'offline' | 'error';
    lastSeen: string | null;
    version: string;
  }> {
    const guild = await this.findGuildByIdOrDiscordId(guildIdOrDiscordId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const settings = await this.serverSettingsRepository.findOne({
      where: { guildId: guild.id },
    });
    const status = settings?.botConnected ? 'online' : 'offline';
    return {
      status,
      lastSeen: settings?.lastConnected?.toISOString() ?? null,
      version: '1.0',
    };
  }

  async getModules(discordGuildId: string): Promise<GuildSettingsResponseDto['modules']> {
    const settings = await this.getSettings(discordGuildId);
    return settings.modules;
  }

  async getActivitySparkline(
    guildIdOrDiscordId: string,
  ): Promise<{ data: number[]; level: ActivityLevel }> {
    const guild = await this.findGuildByIdOrDiscordId(guildIdOrDiscordId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const settings = await this.serverSettingsRepository.findOne({
      where: { guildId: guild.id },
    });
    const data = Array(24).fill(0) as number[];
    const level = computeActivityLevel(!!settings?.botConnected, data);
    return { data, level };
  }

  async updateSettings(
    guildIdOrDiscordId: string,
    dto: {
      serverName?: string;
      serverDescription?: string;
      language?: string;
      timezone?: string;
      botToken?: string;
      dataRetentionDays?: number;
      anonymizeUserData?: boolean;
      shareAnalytics?: boolean;
      allowPublicWidgets?: boolean;
    },
  ): Promise<GuildSettingsResponseDto> {
    const guild = await this.findGuildByIdOrDiscordId(guildIdOrDiscordId);
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
    if (dto.serverName !== undefined) settings.serverName = dto.serverName;
    if (dto.serverDescription !== undefined)
      settings.serverDescription = dto.serverDescription;
    if (dto.language !== undefined) settings.language = dto.language;
    if (dto.timezone !== undefined) settings.timezone = dto.timezone;
    if (dto.dataRetentionDays !== undefined)
      settings.dataRetentionDays = dto.dataRetentionDays;
    if (dto.anonymizeUserData !== undefined)
      settings.anonymizeUserData = dto.anonymizeUserData;
    if (dto.shareAnalytics !== undefined)
      settings.shareAnalytics = dto.shareAnalytics;
    if (dto.allowPublicWidgets !== undefined)
      settings.allowPublicWidgets = dto.allowPublicWidgets;
    await this.serverSettingsRepository.save(settings);
    if (dto.botToken !== undefined) {
      await this.updateToken(guildIdOrDiscordId, { botToken: dto.botToken });
    }
    return this.getSettings(guildIdOrDiscordId);
  }

  async getUserGuilds(userId: string): Promise<UserGuildDto[]> {
    return this.guildsRealtime.getUserGuilds(userId);
  }

  /**
   * Проверяет, есть ли у пользователя права администратора/управления гильдией в Discord (по кэшу или Discord API).
   * Fallback: владелец гильдии (ownerId) всегда имеет доступ — для smoke-тестов без Discord OAuth.
   */
  async userHasGuildAdmin(userId: string, discordGuildId: string): Promise<boolean> {
    return this.guildsRealtime.userHasGuildAdmin(userId, discordGuildId);
  }

  /** UUID (guild.id) или Discord Snowflake (discord_guild_id). */
  private static isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  /**
   * Ищет гильдию по внутреннему UUID (guild.id) или по Discord Snowflake (discord_guild_id).
   * Позволяет принимать в :guildId как UUID (из ответа onboard), так и snowflake (из списка гильдий).
   * Вход всегда приводится к string (Snowflake в JS должен быть строкой из-за Number.MAX_SAFE_INTEGER).
   */
  async findGuildByIdOrDiscordId(guildIdOrDiscordId: string | number): Promise<Guild | null> {
    const id = typeof guildIdOrDiscordId === 'string' ? guildIdOrDiscordId : String(guildIdOrDiscordId);
    const cached = this.guildContext.getGuild(id);
    if (cached) return cached;
    return this.guildsRealtime.findGuildByIdOrDiscordId(id);
  }

  async findGuildByDiscordId(discordGuildId: string): Promise<Guild | null> {
    return this.guildsRealtime.findGuildByDiscordId(discordGuildId);
  }

  /**
   * Возвращает настройки гильдии и модули. Реальный токен не передаётся; в ответе только hasToken.
   * guildIdOrDiscordId — внутренний UUID (guild.id) или Discord Snowflake.
   */
  async getSettings(guildIdOrDiscordId: string): Promise<GuildSettingsResponseDto> {
    const guild = await this.findGuildByIdOrDiscordId(guildIdOrDiscordId);
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
    guildIdOrDiscordId: string,
    dto: PatchGuildModulesDto,
  ): Promise<GuildSettingsResponseDto['modules']> {
    const guild = await this.findGuildByIdOrDiscordId(guildIdOrDiscordId);
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
    guildIdOrDiscordId: string,
    dto: PatchGuildTokenDto,
  ): Promise<{ botToken: string | null }> {
    const guild = await this.findGuildByIdOrDiscordId(guildIdOrDiscordId);
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
        discordGuildId: guild.discordGuildId,
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
    this.logger.log(
      `onboardGuild called: discordGuildId=${discordGuildId} ownerUserId=${ownerUserId} name=${name ?? '(none)'}`,
    );
    const existing = await this.guildRepository.findOne({
      where: { discordGuildId },
    });
    if (existing) {
      existing.ownerId = ownerUserId;
      await this.guildRepository.save(existing);
      this.logger.log(
        `onboardGuild: guild already existed (e.g. from guild:setup), updated owner to ${ownerUserId}`,
      );
      return { guildId: existing.id };
    }

    const serverName = name ?? DEFAULT_GUILD_NAME;

    try {
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
        anonymizeUserData: false,
        shareAnalytics: true,
        allowPublicWidgets: true,
        updatedAt: new Date(),
      });
      await this.serverSettingsRepository.save(settings);

      await this.historySyncQueue
        .addHistorySync({ guildId: savedGuild.id, discordGuildId })
        .catch(() => {});

      return { guildId: savedGuild.id };
    } catch (err) {
      const driverErr = err instanceof QueryFailedError ? (err as QueryFailedError).driverError as { code?: string; constraint?: string } : undefined;
      const isDuplicateGuild =
        driverErr?.code === '23505' &&
        (driverErr?.constraint?.includes('discord_guild_id') ?? (err as Error).message.includes('discord_guild_id'));
      if (isDuplicateGuild) {
        const createdBySetup = await this.guildRepository.findOne({
          where: { discordGuildId },
        });
        if (createdBySetup) {
          createdBySetup.ownerId = ownerUserId;
          await this.guildRepository.save(createdBySetup);
          let serverSettings = await this.serverSettingsRepository.findOne({
            where: { guildId: createdBySetup.id },
          });
          if (!serverSettings) {
            serverSettings = this.serverSettingsRepository.create({
              guildId: createdBySetup.id,
              serverName: createdBySetup.name ?? serverName,
              serverDescription: null,
              language: DEFAULT_LANGUAGE,
              timezone: 'UTC',
              botTokenEncrypted: null,
              botConnected: false,
              botUserId: null,
              lastConnected: null,
              lastSyncAt: null,
              dataRetentionDays: 0,
              anonymizeUserData: false,
              shareAnalytics: true,
              allowPublicWidgets: true,
              updatedAt: new Date(),
            });
            await this.serverSettingsRepository.save(serverSettings);
          }
          this.logger.log(
            `onboardGuild: guild was created by guild:setup (race), updated owner to ${ownerUserId}`,
          );
          await this.historySyncQueue
            .addHistorySync({ guildId: createdBySetup.id, discordGuildId })
            .catch(() => {});
          return { guildId: createdBySetup.id };
        }
      }
      throw err;
    }
  }

  /**
   * Возвращает токен бота: сначала из server_settings (кастомный бот), иначе DISCORD_BOT_TOKEN из env (основной бот).
   */
  private async resolveToken(guildId: string): Promise<string | null> {
    const settings = await this.serverSettingsRepository.findOne({
      where: { guildId },
      select: ['botTokenEncrypted'],
    });
    if (settings?.botTokenEncrypted && settings.botTokenEncrypted.length > 0) {
      try {
        return this.crypto.decrypt(settings.botTokenEncrypted);
      } catch {
        return null;
      }
    }
    return this.configService.get<string>('DISCORD_BOT_TOKEN') ?? null;
  }

  /**
   * Возвращает список текстовых каналов гильдии из Discord API (бот должен быть на сервере, токен настроен).
   * При отсутствии токена или ошибке Discord API возвращает пустой массив.
   */
  async getChannelsForGuild(guildIdOrDiscordId: string): Promise<GuildChannelDto[]> {
    const guild = await this.findGuildByIdOrDiscordId(guildIdOrDiscordId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const token = await this.resolveToken(guild.id);
    if (!token) return [];
    try {
      const response = await firstValueFrom(
        this.httpService.get<Array<{ id: string; name: string; type: number }>>(
          `${DISCORD_API_BASE}/guilds/${guild.discordGuildId}/channels`,
          {
            headers: { Authorization: `Bot ${token}` },
          },
        ),
      );
      const channels = response.data ?? [];
      return channels
        .filter((c) => c.type === CHANNEL_TYPE_TEXT)
        .map((c) => ({ id: c.id, name: c.name }));
    } catch {
      return [];
    }
  }

  /**
   * Возвращает список каналов (текстовых и голосовых) для маппинга в topChannels.
   * При отсутствии токена или ошибке Discord API возвращает пустой массив.
   */
  async getChannelsWithTypeForGuild(
    guildIdOrDiscordId: string,
  ): Promise<GuildChannelWithTypeDto[]> {
    const guild = await this.findGuildByIdOrDiscordId(guildIdOrDiscordId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const token = await this.resolveToken(guild.id);
    if (!token) return [];
    try {
      const response = await firstValueFrom(
        this.httpService.get<Array<{ id: string; name: string; type: number }>>(
          `${DISCORD_API_BASE}/guilds/${guild.discordGuildId}/channels`,
          {
            headers: { Authorization: `Bot ${token}` },
          },
        ),
      );
      const channels = response.data ?? [];
      return channels
        .filter((c) => c.type === CHANNEL_TYPE_TEXT || c.type === CHANNEL_TYPE_VOICE)
        .map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type === CHANNEL_TYPE_VOICE ? 'voice' : 'text',
        }));
    } catch {
      return [];
    }
  }

  /**
   * Возвращает список ролей гильдии из Discord API для маппинга в roleDistribution.
   * При отсутствии токена или ошибке Discord API возвращает пустой массив.
   */
  async getRolesForGuild(guildIdOrDiscordId: string): Promise<GuildRoleDto[]> {
    const guild = await this.findGuildByIdOrDiscordId(guildIdOrDiscordId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found or access denied',
      });
    }
    const token = await this.resolveToken(guild.id);
    if (!token) return [];
    try {
      const response = await firstValueFrom(
        this.httpService.get<Array<{ id: string; name: string; color: number }>>(
          `${DISCORD_API_BASE}/guilds/${guild.discordGuildId}/roles`,
          {
            headers: { Authorization: `Bot ${token}` },
          },
        ),
      );
      const roles = response.data ?? [];
      return roles.map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : '',
      }));
    } catch {
      return [];
    }
  }
}
