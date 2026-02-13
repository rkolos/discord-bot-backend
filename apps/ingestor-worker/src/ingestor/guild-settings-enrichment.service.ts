import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guild, ServerSettings } from '@app/shared';
import { DEFAULT_ANALYTICS_EVENT_TYPES_BLACKLIST } from './constants';

export interface GuildSettingsEnrichment {
  anonymizeUserData: boolean;
  planTier: string;
  /** Типы событий, которые не писать в ClickHouse. */
  analyticsEventTypesBlacklist: string[];
}

@Injectable()
export class GuildSettingsEnrichmentService {
  constructor(
    @InjectRepository(ServerSettings)
    private readonly serverSettingsRepository: Repository<ServerSettings>,
    @InjectRepository(Guild)
    private readonly guildRepository: Repository<Guild>,
  ) {}

  /**
   * Возвращает настройки гильдии по внутреннему UUID для обогащения события
   * (anonymize_user_data, plan_tier, analytics_event_types_blacklist). При отсутствии записи — дефолт: анонимизация выключена, blacklist по умолчанию.
   */
  async getSettings(guildId: string): Promise<GuildSettingsEnrichment> {
    const [settings, guild] = await Promise.all([
      this.serverSettingsRepository.findOne({
        where: { guildId },
        select: ['anonymizeUserData', 'analyticsEventTypesBlacklist'],
      }),
      this.guildRepository.findOne({
        where: { id: guildId },
        select: ['subscriptionTier'],
      }),
    ]);
    const rawList = settings?.analyticsEventTypesBlacklist;
    const analyticsEventTypesBlacklist =
      Array.isArray(rawList) && rawList.length > 0
        ? rawList
        : DEFAULT_ANALYTICS_EVENT_TYPES_BLACKLIST;
    return {
      anonymizeUserData: settings?.anonymizeUserData ?? false,
      planTier: guild?.subscriptionTier ?? 'free',
      analyticsEventTypesBlacklist,
    };
  }
}
