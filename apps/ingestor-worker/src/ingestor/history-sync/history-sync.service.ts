import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Guild,
  HistorySyncStatus,
  ServerSettings,
  SharedConfigService,
  CryptoService,
  computeAnonymizedHash,
} from '@app/shared';
import type { RawEvent } from '../ingestor.types';
import { computeRetentionUntil } from '../retention.helper';
import type { GuildSettingsEnrichment } from '../guild-settings-enrichment.service';
import { ClickHouseService } from '@app/shared';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const GUILD_TEXT_TYPE = 0;
const MESSAGES_LIMIT_PER_REQUEST = 100;

interface DiscordChannel {
  id: string;
  type: number;
}

interface DiscordMessage {
  id: string;
  channel_id: string;
  author?: { id: string; bot?: boolean };
  content?: string;
  timestamp: string;
}

@Injectable()
export class HistorySyncService {
  private readonly logger = new Logger(HistorySyncService.name);

  constructor(
    private readonly sharedConfig: SharedConfigService,
    private readonly configService: ConfigService,
    private readonly crypto: CryptoService,
    private readonly clickhouse: ClickHouseService,
    @InjectRepository(Guild)
    private readonly guildRepository: Repository<Guild>,
    @InjectRepository(ServerSettings)
    private readonly serverSettingsRepository: Repository<ServerSettings>,
  ) {}

  async resolveToken(guildId: string): Promise<string> {
    const settings = await this.serverSettingsRepository.findOne({
      where: { guildId },
      select: ['botTokenEncrypted'],
    });
    if (settings?.botTokenEncrypted) {
      try {
        return this.crypto.decrypt(settings.botTokenEncrypted);
      } catch (err) {
        this.logger.warn(`Failed to decrypt token for guild ${guildId}: ${(err as Error).message}`);
      }
    }
    const mainToken = this.configService.get<string>('DISCORD_BOT_TOKEN');
    if (!mainToken) {
      throw new Error('DISCORD_BOT_TOKEN not set');
    }
    return mainToken;
  }

  async run(guildId: string, discordGuildId: string, enrichment: GuildSettingsEnrichment): Promise<void> {
    await this.guildRepository.update(
      { id: guildId },
      { historySyncStatus: HistorySyncStatus.PROCESSING },
    );

    try {
      const token = await this.resolveToken(guildId);
      const channels = await this.fetchChannels(discordGuildId, token);
      const textChannels = channels.filter((c) => c.type === GUILD_TEXT_TYPE);

      const { scanDepth, concurrency } = this.sharedConfig.historySync;
      const existingMessageIds = await this.fetchExistingMessageIds(guildId);

      const events: RawEvent[] = [];
      const concurrencyLimit = Math.min(concurrency, textChannels.length) || 1;
      for (let i = 0; i < textChannels.length; i += concurrencyLimit) {
        const batch = textChannels.slice(i, i + concurrencyLimit);
        const results = await Promise.all(
          batch.map((ch) => this.fetchMessagesForChannel(discordGuildId, guildId, ch.id, token, scanDepth)),
        );
        for (const channelEvents of results) {
          for (const e of channelEvents) {
            const msgId = (JSON.parse(e.payload) as { messageId?: string }).messageId;
            if (msgId && !existingMessageIds.has(msgId)) {
              existingMessageIds.add(msgId);
              events.push(e);
            }
          }
        }
      }

      for (const e of events) {
        (e as RawEvent & { planTier?: string; anonymizeUserData?: boolean }).planTier = enrichment.planTier;
        (e as RawEvent & { anonymizeUserData?: boolean }).anonymizeUserData = enrichment.anonymizeUserData;
      }

      if (events.length > 0) {
        await this.insertEvents(events);
      }

      await this.guildRepository.update(
        { id: guildId },
        { historySyncStatus: HistorySyncStatus.COMPLETED },
      );
      this.logger.log(`History sync completed for guild ${guildId}: ${events.length} events`);
    } catch (err) {
      this.logger.error(`History sync failed for guild ${guildId}: ${(err as Error).message}`);
      await this.guildRepository.update(
        { id: guildId },
        { historySyncStatus: HistorySyncStatus.FAILED },
      );
      throw err;
    }
  }

  private async fetchChannels(discordGuildId: string, token: string): Promise<DiscordChannel[]> {
    const res = await fetch(`${DISCORD_API_BASE}/guilds/${discordGuildId}/channels`, {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Discord channels fetch failed: ${res.status}`);
    }
    return (await res.json()) as DiscordChannel[];
  }

  private async fetchMessagesForChannel(
    discordGuildId: string,
    guildId: string,
    channelId: string,
    token: string,
    scanDepth: number,
  ): Promise<RawEvent[]> {
    const events: RawEvent[] = [];
    let before: string | undefined;
    let fetched = 0;

    while (fetched < scanDepth) {
      const limit = Math.min(MESSAGES_LIMIT_PER_REQUEST, scanDepth - fetched);
      const url = new URL(`${DISCORD_API_BASE}/channels/${channelId}/messages`);
      url.searchParams.set('limit', String(limit));
      if (before) url.searchParams.set('before', before);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bot ${token}` },
      });
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10) * 1000;
        this.logger.warn(`Discord rate limit, waiting ${retryAfter}ms`);
        await new Promise((r) => setTimeout(r, retryAfter));
        continue;
      }
      if (!res.ok) {
        if (res.status === 403 || res.status === 404) break;
        throw new Error(`Discord messages fetch failed: ${res.status}`);
      }

      const messages = (await res.json()) as DiscordMessage[];
      if (messages.length === 0) break;

      for (const msg of messages) {
        const payload = {
          messageId: msg.id,
          channelId: msg.channel_id,
          userId: msg.author?.id,
          content: msg.content ?? '',
          timestamp: msg.timestamp,
        };
        const eventId = toHistUuid(msg.id);
        events.push({
          eventId,
          eventTime: msg.timestamp,
          eventType: 'MESSAGE_CREATE',
          guildId,
          discordGuildId,
          channelId: msg.channel_id,
          discordUserId: msg.author?.id ?? undefined,
          planTier: 'free',
          isBotGenerated: msg.author?.bot ?? false,
          payload: JSON.stringify(payload),
          isHistorical: true,
        });
        before = msg.id;
      }
      fetched += messages.length;
      if (messages.length < limit) break;
    }

    return events;
  }

  private async fetchExistingMessageIds(guildId: string): Promise<Set<string>> {
    const db = this.sharedConfig.clickhouse.database || 'default';
    try {
      const result = await this.clickhouse.query({
        query: `SELECT JSONExtractString(payload, 'messageId') AS msg_id
                FROM ${db}.raw_events
                WHERE guild_id = {guildId:String} AND event_type = 'MESSAGE_CREATE'`,
        query_params: { guildId },
      });
      const json = (await result.json()) as Array<{ msg_id: string }> | { data?: Array<{ msg_id: string }> };
      const rows = Array.isArray(json) ? json : (json.data ?? []);
      return new Set(rows.map((r) => r.msg_id).filter(Boolean));
    } catch {
      return new Set();
    }
  }

  private async insertEvents(events: RawEvent[]): Promise<void> {
    const salt = this.sharedConfig.auth.anonymizationSalt;
    const values = events.map((e) => {
      const eventTime = typeof e.eventTime === 'string' ? e.eventTime : (e.eventTime as Date).toISOString();
      const eventTimeStr = eventTime.replace('T', ' ').replace('Z', '').slice(0, 19);
      const eventDate = eventTimeStr.slice(0, 10);
      const planTier = (e as { planTier?: string }).planTier ?? 'free';
      const anonymizeUserData = (e as { anonymizeUserData?: boolean }).anonymizeUserData ?? true;
      const retentionUntil = computeRetentionUntil(e.eventTime, planTier);
      const shouldAnonymize =
        anonymizeUserData && e.discordUserId != null && String(e.discordUserId).trim() !== '';
      const anonymizedHash = shouldAnonymize && salt ? computeAnonymizedHash(String(e.discordUserId), salt) : null;
      const discordUserIdForRow = shouldAnonymize ? '' : (e.discordUserId ?? '');
      return {
        event_id: e.eventId,
        event_time: eventTimeStr,
        event_date: eventDate,
        event_type: e.eventType,
        guild_id: e.guildId,
        discord_guild_id: e.discordGuildId,
        user_id: null,
        discord_user_id: discordUserIdForRow,
        anonymized_hash: anonymizedHash,
        channel_id: e.channelId ?? '',
        role_id: '',
        command_name: '',
        plan_tier: planTier,
        is_bot_generated: e.isBotGenerated ? 1 : 0,
        payload: e.payload,
        ingested_at: new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19),
        retention_until: retentionUntil.toISOString().replace('T', ' ').replace('Z', '').slice(0, 19),
        is_historical: 1,
      };
    });

    const table = `${this.sharedConfig.clickhouse.database || 'default'}.raw_events`;
    await this.clickhouse.insert({ table, values, format: 'JSONEachRow' });
  }
}

function toHistUuid(messageId: string): string {
  const hash = createHash('sha256').update(`hist-${messageId}`).digest('hex').slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
