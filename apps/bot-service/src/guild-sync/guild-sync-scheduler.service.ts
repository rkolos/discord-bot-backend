import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guild, ServerSettings } from '@app/shared';
import { GuildSyncInternalService } from '../internal/guild-sync-internal.service';

const SYNC_INTERVAL_MINUTES = 30;
const MAX_GUILDS_PER_RUN = 10;

@Injectable()
export class GuildSyncSchedulerService {
  private readonly logger = new Logger(GuildSyncSchedulerService.name);

  constructor(
    @InjectRepository(Guild)
    private readonly guildRepository: Repository<Guild>,
    @InjectRepository(ServerSettings)
    private readonly settingsRepository: Repository<ServerSettings>,
    private readonly guildSyncInternal: GuildSyncInternalService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * По расписанию: каждые 15 минут.
   * Синхронизирует member_count, online_members для гильдий, где lastSyncAt старше 30 мин.
   * Отключение: GUILD_SYNC_SCHEDULER_ENABLED=false.
   */
  @Cron('0 */15 * * * *')
  async runScheduledSync(): Promise<void> {
    const enabled = this.configService.get<string>('GUILD_SYNC_SCHEDULER_ENABLED');
    if (enabled === 'false' || enabled === '0') {
      return;
    }

    try {
      const cutoff = new Date(Date.now() - SYNC_INTERVAL_MINUTES * 60 * 1000);
      const staleGuilds = await this.guildRepository
        .createQueryBuilder('g')
        .innerJoin(ServerSettings, 's', 's.guild_id = g.id')
        .where('g.is_bot_in_guild = true')
        .andWhere('(s.last_sync_at IS NULL OR s.last_sync_at < :cutoff)', {
          cutoff,
        })
        .select('g.id')
        .limit(MAX_GUILDS_PER_RUN)
        .getMany();

      const staleGuildIds = staleGuilds.map((g) => g.id);

      for (const guildId of staleGuildIds) {
        try {
          await this.guildSyncInternal.syncGuild(guildId);
        } catch (err) {
          this.logger.warn(
            `Guild sync failed for ${guildId}: ${(err as Error).message}`,
          );
        }
      }

      if (staleGuildIds.length > 0) {
        this.logger.debug(`Scheduled sync: synced ${staleGuildIds.length} guilds`);
      }
    } catch (err) {
      this.logger.warn(`Scheduled guild sync error: ${(err as Error).message}`);
    }
  }
}
