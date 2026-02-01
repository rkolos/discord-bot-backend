/**
 * Обработчики событий Discord для логов и счётчиков в shard-worker.
 * Не зависит от NestJS: использует AppDataSource, Redis, BullMQ Queue.
 */
import type Redis from 'ioredis';
import { Queue } from 'bullmq';
import { EmbedBuilder } from 'discord.js';
import { randomUUID } from 'crypto';
import { AppDataSource } from '@app/shared';
import { Guild, GuildLogSetting, Counter, CounterMetric } from '@app/shared';
import { buildLogEmbedData } from '@app/shared';
import {
  COUNTERS_UPDATE_QUEUE_NAME,
  type CounterUpdateJobPayload,
} from '@app/shared';
import {
  INGESTOR_RAW_EVENTS_QUEUE_NAME,
  type RawEventJobPayload,
} from '../raw-events/raw-events-queue.types';

const MEMBER_COUNT_CACHE_PREFIX = 'bot-service:cache:guild:';
const MEMBER_COUNT_SUFFIX = ':member_count';
const LOG_SETTINGS_CACHE_PREFIX = 'bot-service:cache:log-settings:';

export interface ShardEventHandlersOptions {
  redis: Redis;
  redisPrefix: string;
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
  getGuildId: (discordGuildId: string) => Promise<string | null>;
  /** Получить канал по ID для отправки лога (например client.channels.fetch) */
  fetchChannel: (channelId: string) => Promise<{ send: (opts: { embeds: unknown[] }) => Promise<unknown> } | null>;
}

type GuildMemberLike = { guild: { id: string; memberCount?: number }; user?: { id: string; tag?: string } };
type MessageLike = { id?: string; channelId?: string; channel?: { name?: string; guild?: { id: string } }; author?: { id: string; tag?: string }; content?: string };
type VoiceStateLike = {
  guild: { id: string };
  channelId: string | null;
  channel?: { id?: string; name?: string } | null;
  member?: { user: { id: string; tag?: string } };
};
type GuildMemberUpdateLike = { guild: { id: string }; roles: { cache: Map<string, { name: string }> }; user: { id: string; tag?: string } };

export function createShardEventHandlers(options: ShardEventHandlersOptions) {
  const { redis, redisPrefix, getGuildId, fetchChannel } = options;

  const rawEventsQueue = new Queue<RawEventJobPayload>(INGESTOR_RAW_EVENTS_QUEUE_NAME, {
    connection: {
      host: options.redisHost,
      port: options.redisPort,
      password: options.redisPassword,
    },
    prefix: redisPrefix,
  });

  const countersQueue = new Queue<CounterUpdateJobPayload>(COUNTERS_UPDATE_QUEUE_NAME, {
    connection: {
      host: options.redisHost,
      port: options.redisPort,
      password: options.redisPassword,
    },
    prefix: redisPrefix,
  });

  async function getLogSettings(guildId: string): Promise<Map<string, { channelId: string | null; enabled: boolean }>> {
    const cacheKey = `${redisPrefix}${LOG_SETTINGS_CACHE_PREFIX}${guildId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        const obj = JSON.parse(cached) as Record<string, { channelId: string | null; enabled: boolean }>;
        return new Map(Object.entries(obj));
      } catch {
        // fall through to DB
      }
    }
    const repo = AppDataSource.getRepository(GuildLogSetting);
    const rows = await repo.find({ where: { guildId } });
    const map = new Map<string, { channelId: string | null; enabled: boolean }>();
    for (const r of rows) {
      map.set(r.eventType, { channelId: r.channelId, enabled: r.enabled });
    }
    return map;
  }

  function embedFromData(data: ReturnType<typeof buildLogEmbedData>) {
    const embed = new EmbedBuilder().setTitle(data.title);
    if (data.description) embed.setDescription(data.description);
    for (const f of data.fields) {
      embed.addFields({ name: f.name, value: f.value });
    }
    return embed;
  }

  async function sendLogAndIngest(
    discordGuildId: string,
    guildId: string | null,
    eventType: string,
    payload: Record<string, unknown>,
    embedPayload: Parameters<typeof buildLogEmbedData>[1],
    rawPayloadOverrides?: Partial<RawEventJobPayload>,
  ): Promise<void> {
    if (!guildId) return;
    const rawPayload: RawEventJobPayload = {
      eventId: randomUUID(),
      eventType,
      eventTime: new Date().toISOString(),
      guildId,
      discordGuildId,
      payload,
      ...rawPayloadOverrides,
    };

    if (eventType === 'voice_change') {
      await rawEventsQueue.add(eventType, rawPayload, { priority: 0 }).catch((err) => {
        console.error(`[shard-events] raw-events enqueue error: ${(err as Error).message}`);
      });
    }

    const settings = await getLogSettings(guildId);
    const setting = settings.get(eventType);
    if (!setting?.enabled || !setting.channelId) return;

    const channel = await fetchChannel(setting.channelId);
    if (!channel) return;

    const embedData = buildLogEmbedData(eventType, embedPayload);
    const embed = embedFromData(embedData);
    await channel.send({ embeds: [embed] }).catch((err) => {
      console.error(`[shard-events] send log error: ${(err as Error).message}`);
    });

    if (eventType !== 'voice_change') {
      await rawEventsQueue.add(eventType, rawPayload, { priority: 0 }).catch((err) => {
        console.error(`[shard-events] raw-events enqueue error: ${(err as Error).message}`);
      });
    }
  }

  async function touchGuildLastActivity(discordGuildId: string): Promise<void> {
    const guildRepo = AppDataSource.getRepository(Guild);
    await guildRepo
      .update({ discordGuildId }, { lastActivity: new Date() })
      .catch(() => {});
  }

  async function updateMemberCountAndCounters(discordGuildId: string, guildId: string | null, memberCount: number): Promise<void> {
    if (!guildId) return;
    const key = `${redisPrefix}${MEMBER_COUNT_CACHE_PREFIX}${guildId}${MEMBER_COUNT_SUFFIX}`;
    await redis.set(key, String(memberCount)).catch(() => {});

    const guildRepo = AppDataSource.getRepository(Guild);
    await guildRepo.update({ discordGuildId }, { memberCount }).catch(() => {});

    const counterRepo = AppDataSource.getRepository(Counter);
    const counters = await counterRepo.find({
      where: { guildId, metric: CounterMetric.MEMBERS },
      select: ['id', 'guildId', 'channelId', 'type', 'metric'],
    });
    for (const c of counters) {
      await countersQueue.add('update', {
        counter_id: c.id,
        guild_id: c.guildId,
        channel_id: c.channelId,
        type: c.type,
        metric: c.metric,
      } as CounterUpdateJobPayload, { priority: 0 }).catch(() => {});
    }
  }

  return {
    async onGuildMemberAdd(member: GuildMemberLike & { guild: { memberCount: number } }): Promise<void> {
      const discordGuildId = member.guild.id;
      const guildId = await getGuildId(discordGuildId);
      const memberCount = member.guild.memberCount ?? 0;

      await updateMemberCountAndCounters(discordGuildId, guildId, memberCount);
      if (guildId) touchGuildLastActivity(discordGuildId).catch(() => {});

      await sendLogAndIngest(
        discordGuildId,
        guildId,
        'member_join',
        { userId: member.user?.id, userTag: member.user?.tag },
        {
          userTag: member.user?.tag ?? undefined,
          userId: member.user?.id ?? undefined,
          timestamp: new Date().toISOString(),
        },
      );
    },

    async onGuildMemberRemove(member: GuildMemberLike): Promise<void> {
      const discordGuildId = member.guild.id;
      const guildId = await getGuildId(discordGuildId);
      const memberCount = typeof member.guild.memberCount === 'number' ? member.guild.memberCount : 0;

      await updateMemberCountAndCounters(discordGuildId, guildId, memberCount);
      if (guildId) touchGuildLastActivity(discordGuildId).catch(() => {});

      await sendLogAndIngest(
        discordGuildId,
        guildId,
        'member_leave',
        { userId: member.user?.id, userTag: member.user?.tag },
        {
          userTag: member.user?.tag ?? undefined,
          userId: member.user?.id ?? undefined,
          timestamp: new Date().toISOString(),
        },
      );
    },

    async onMessageDelete(message: MessageLike): Promise<void> {
      const channel = message.channel as { guild?: { id: string } } | undefined;
      const discordGuildId = channel?.guild?.id;
      if (!discordGuildId) return;
      const guildId = await getGuildId(discordGuildId);
      if (guildId) touchGuildLastActivity(discordGuildId).catch(() => {});

      await sendLogAndIngest(
        discordGuildId,
        guildId,
        'message_delete',
        { messageId: message.id, channelId: message.channelId, userId: message.author?.id },
        {
          channelName: (message.channel as { name?: string })?.name ?? undefined,
          userTag: message.author?.tag ?? undefined,
          userId: message.author?.id ?? undefined,
          messageContent: message.content ?? undefined,
          timestamp: new Date().toISOString(),
        },
      );
    },

    async onMessageUpdate(oldMessage: MessageLike, newMessage: MessageLike): Promise<void> {
      const channel = oldMessage.channel as { guild?: { id: string } } | undefined;
      const discordGuildId = channel?.guild?.id;
      if (!discordGuildId) return;
      const guildId = await getGuildId(discordGuildId);
      if (guildId) touchGuildLastActivity(discordGuildId).catch(() => {});

      await sendLogAndIngest(
        discordGuildId,
        guildId,
        'message_edit',
        { messageId: newMessage?.id, channelId: oldMessage.channelId },
        {
          channelName: (oldMessage.channel as { name?: string })?.name ?? undefined,
          userTag: oldMessage.author?.tag ?? undefined,
          userId: oldMessage.author?.id ?? undefined,
          oldContent: oldMessage.content ?? undefined,
          newContent: newMessage?.content ?? undefined,
          timestamp: new Date().toISOString(),
        },
      );
    },

    async onVoiceStateUpdate(oldState: VoiceStateLike, newState: VoiceStateLike): Promise<void> {
      const discordGuildId = oldState.guild.id;
      const guildId = await getGuildId(discordGuildId);
      if (guildId) touchGuildLastActivity(discordGuildId).catch(() => {});

      const voiceChannelName = (newState.channel ?? oldState.channel)?.name ?? undefined;
      const discordUserId = (newState.member ?? oldState.member)?.user?.id;
      const channelId =
        (newState.channel ?? oldState.channel)?.id ??
        newState.channelId ??
        oldState.channelId ??
        null;

      await sendLogAndIngest(
        discordGuildId,
        guildId,
        'voice_change',
        {
          userId: discordUserId,
          userTag: (newState.member ?? oldState.member)?.user?.tag,
          voiceChannelName,
          channelId: channelId ?? undefined,
          timestamp: new Date().toISOString(),
        },
        {
          userTag: (newState.member ?? oldState.member)?.user?.tag ?? undefined,
          userId: discordUserId ?? undefined,
          voiceChannelName,
          timestamp: new Date().toISOString(),
        },
        { discordUserId: discordUserId ?? undefined, channelId: channelId ?? undefined },
      );
    },

    async onGuildMemberUpdate(oldMember: GuildMemberUpdateLike, newMember: { roles: { cache: Map<string, { name: string }> } }): Promise<void> {
      const discordGuildId = oldMember.guild.id;
      const guildId = await getGuildId(discordGuildId);
      const oldRoleNames = Array.from(oldMember.roles.cache?.values() ?? []).map((r) => r.name);
      const newRoleNames = Array.from(newMember.roles.cache?.values() ?? []).map((r) => r.name);
      const added = newRoleNames.filter((n) => !oldRoleNames.includes(n));
      const removed = oldRoleNames.filter((n) => !newRoleNames.includes(n));

      await sendLogAndIngest(
        discordGuildId,
        guildId,
        'role_update',
        { userId: oldMember.user?.id },
        {
          userTag: oldMember.user?.tag ?? undefined,
          userId: oldMember.user?.id ?? undefined,
          rolesAdded: added.length ? added : undefined,
          rolesRemoved: removed.length ? removed : undefined,
          timestamp: new Date().toISOString(),
        },
      );
    },

    destroy(): Promise<void> {
      return Promise.all([rawEventsQueue.close(), countersQueue.close()]).then(() => undefined);
    },
  };
}
