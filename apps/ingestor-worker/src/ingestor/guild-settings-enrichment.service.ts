import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guild, ServerSettings } from '@app/shared';

export interface GuildSettingsEnrichment {
  anonymizeUserData: boolean;
  planTier: string;
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
   * (anonymize_user_data, plan_tier). При отсутствии записи — дефолт: анонимизация выключена.
   */
  async getSettings(guildId: string): Promise<GuildSettingsEnrichment> {
    const [settings, guild] = await Promise.all([
      this.serverSettingsRepository.findOne({
        where: { guildId },
        select: ['anonymizeUserData'],
      }),
      this.guildRepository.findOne({
        where: { id: guildId },
        select: ['subscriptionTier'],
      }),
    ]);
    return {
      anonymizeUserData: settings?.anonymizeUserData ?? false,
      planTier: guild?.subscriptionTier ?? 'free',
    };
  }
}
