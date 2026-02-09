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
  RedisService,
  publishGuildStateEvent,
  computeAnonymizedHash,
} from '@app/shared';
import type { RawEvent } from '../ingestor.types';
import { computeRetentionUntil } from '../retention.helper';
import type { GuildSettingsEnrichment } from '../guild-settings-enrichment.service';
import { ClickHouseService } from '@app/shared';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const GUILD_TEXT_TYPE = 0;
const MESSAGES_LIMIT_PER_REQUEST = 100;
/** Максимум строк в одном INSERT в ClickHouse, чтобы не перегружать память и не упираться в лимиты. */
const CLICKHOUSE_INSERT_CHUNK_SIZE = 10_000;

interface DiscordChannel {
  id: string;
  type: number;
}

interface DiscordMessage {
  id: string;
  channel_id: string;
  author?: {
    id: string;
    bot?: boolean;
    username?: string;
    discriminator?: string;
    global_name?: string | null;
    avatar?: string | null;
  };
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
    private readonly redis: RedisService,
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
    this.logger.log(`[analytics] history sync start guildId=${guildId} discordGuildId=${discordGuildId}`);
    await this.guildRepository.update(
      { id: guildId },
      { historySyncStatus: HistorySyncStatus.PROCESSING },
    );
    publishGuildStateEvent(this.redis.getClient(), this.sharedConfig.redis.prefix, {
      guildId,
      discordGuildId,
      parameter: 'historySyncStatus',
      direction: 'set',
      value: HistorySyncStatus.PROCESSING,
    });

    try {
      const token = await this.resolveToken(guildId);
      const channels = await this.fetchChannels(discordGuildId, token);
      const textChannels = channels.filter((c) => c.type === GUILD_TEXT_TYPE);
      if (textChannels.length === 0) {
        this.logger.log(
          `[analytics] history sync no text channels guildId=${guildId} discordGuildId=${discordGuildId}`,
        );
      }

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

      const messageCountKeySuffix = 'bot-service:guild-state:message-count:';
      if (events.length > 0) {
        await this.insertEvents(events);
        const newTotal = await this.getTotalMessagesCount(guildId);
        await this.redis.getClient().set(messageCountKeySuffix + guildId, String(newTotal)).catch(() => {});
        publishGuildStateEvent(this.redis.getClient(), this.sharedConfig.redis.prefix, {
          guildId,
          discordGuildId,
          parameter: 'totalMessages',
          direction: 'set',
          value: newTotal,
        });
      }

      await this.guildRepository.update(
        { id: guildId },
        { historySyncStatus: HistorySyncStatus.COMPLETED },
      );
      publishGuildStateEvent(this.redis.getClient(), this.sharedConfig.redis.prefix, {
        guildId,
        discordGuildId,
        parameter: 'historySyncStatus',
        direction: 'set',
        value: HistorySyncStatus.COMPLETED,
      });
      this.logger.log(`[analytics] history sync completed guildId=${guildId} events=${events.length}`);
    } catch (err) {
      this.logger.error(`[analytics] history sync failed guildId=${guildId}: ${(err as Error).message}`);
      await this.guildRepository.update(
        { id: guildId },
        { historySyncStatus: HistorySyncStatus.FAILED },
      );
      publishGuildStateEvent(this.redis.getClient(), this.sharedConfig.redis.prefix, {
        guildId,
        discordGuildId,
        parameter: 'historySyncStatus',
        direction: 'set',
        value: HistorySyncStatus.FAILED,
      });
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
        const author = msg.author;
        const userTag =
          author?.username != null
            ? author.discriminator && author.discriminator !== '0'
              ? `${author.username}#${author.discriminator}`
              : (author.global_name ?? author.username)
            : '';
        const payload = {
          messageId: msg.id,
          channelId: msg.channel_id,
          userId: author?.id,
          userTag: userTag || undefined,
          avatar: author?.avatar ?? undefined,
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
                WHERE guild_id = toUUID({guildId:String}) AND event_type = 'MESSAGE_CREATE'`,
        query_params: { guildId },
      });
      const json = (await result.json()) as Array<{ msg_id: string }> | { data?: Array<{ msg_id: string }> };
      const rows = Array.isArray(json) ? json : (json.data ?? []);
      return new Set(rows.map((r) => r.msg_id).filter(Boolean));
    } catch {
      return new Set();
    }
  }

  /** Количество записей MESSAGE_CREATE по гильдии в raw_events (для guild-state totalMessages). */
  private async getTotalMessagesCount(guildId: string): Promise<number> {
    const db = this.sharedConfig.clickhouse.database || 'default';
    try {
      const result = await this.clickhouse.query({
        query: `SELECT count() AS total
                FROM ${db}.raw_events
                WHERE guild_id = toUUID({guildId:String}) AND event_type = 'MESSAGE_CREATE'`,
        query_params: { guildId },
      });
      const json = (await result.json()) as Array<{ total: string | number }> | { data?: Array<{ total: string | number }> };
      const rows = Array.isArray(json) ? json : (json.data ?? []);
      const total = rows[0]?.total;
      return typeof total === 'number' ? total : Number(total ?? 0);
    } catch {
      return 0;
    }
  }

  private async insertEvents(events: RawEvent[]): Promise<void> {
    const salt = this.sharedConfig.auth.anonymizationSalt;
    const values = events.map((e) => {
      const eventTime = typeof e.eventTime === 'string' ? e.eventTime : (e.eventTime as Date).toISOString();
      const eventTimeStr = eventTime.replace('T', ' ').replace('Z', '').slice(0, 19);
      const eventDate = eventTimeStr.slice(0, 10);
      const planTier = (e as { planTier?: string }).planTier ?? 'free';
      const anonymizeUserData = (e as { anonymizeUserData?: boolean }).anonymizeUserData ?? false;
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

    // raw_events партиционирована по toStartOfWeek(event_time); один INSERT не должен затрагивать >100 партиций.
    const byWeek = new Map<string, typeof values>();
    for (const row of values) {
      const weekKey = getWeekStartKey(row.event_time as string);
      const list = byWeek.get(weekKey) ?? [];
      list.push(row);
      byWeek.set(weekKey, list);
    }
    const table = `${this.sharedConfig.clickhouse.database || 'default'}.raw_events`;
    for (const weekRows of byWeek.values()) {
      for (let i = 0; i < weekRows.length; i += CLICKHOUSE_INSERT_CHUNK_SIZE) {
        const chunk = weekRows.slice(i, i + CLICKHOUSE_INSERT_CHUNK_SIZE);
        await this.clickhouse.insert({ table, values: chunk, format: 'JSONEachRow' });
      }
    }
  }
}

/** Понедельник недели в формате YYYY-MM-DD (совпадает с ClickHouse toStartOfWeek). */
function getWeekStartKey(eventTimeStr: string): string {
  const date = new Date(eventTimeStr.replace(' ', 'T') + 'Z');
  const day = date.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - diff);
  return date.toISOString().slice(0, 10);
}

function toHistUuid(messageId: string): string {
  const hash = createHash('sha256').update(`hist-${messageId}`).digest('hex').slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
