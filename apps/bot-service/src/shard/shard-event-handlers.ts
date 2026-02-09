/**
 * Обработчики событий Discord для логов и счётчиков в shard-worker.
 * Не зависит от NestJS: использует AppDataSource, Redis, BullMQ Queue.
 */
import type Redis from 'ioredis';
import { In } from 'typeorm';
import { Queue } from 'bullmq';
import { EmbedBuilder } from 'discord.js';
import { randomUUID } from 'crypto';
import { AppDataSource } from '@app/shared';
import { Guild, GuildLogSetting, GuildWelcomeGoodbyeSetting, Counter, CounterMetric, publishGuildStateEvent, publishDiscordEvent } from '@app/shared';
import { buildLogEmbedData, replacePlaceholders, type WelcomeGoodbyePlaceholderContext } from '@app/shared';
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
const ROLE_COUNTS_CACHE_SUFFIX = ':role_counts';
const LOG_SETTINGS_CACHE_PREFIX = 'bot-service:cache:log-settings:';
const WELCOME_GOODBYE_CACHE_PREFIX = 'bot-service:cache:welcome-goodbye:';
const PRESENCE_CACHE_PREFIX = 'bot-service:presence:';
const VOICE_COUNT_CACHE_PREFIX = 'bot-service:voice-count:';
const ONLINE_MEMBERS_LAST_PREFIX = 'bot-service:guild-state:online-members:';
/** Счётчик сообщений для мгновенной публикации totalMessages (ingestor синхронизирует после flush). */
const MESSAGE_COUNT_CACHE_PREFIX = 'bot-service:guild-state:message-count:';

const EMBED_TITLE_MAX = 256;
const EMBED_DESCRIPTION_MAX = 4096;
const EMBED_FIELD_NAME_MAX = 256;
const EMBED_FIELD_VALUE_MAX = 1024;
const UNKNOWN_USER = 'Unknown User';

const PRESENCE_STATUSES = ['online', 'idle', 'dnd', 'offline'] as const;
function isPresenceStatus(s: string | null): s is (typeof PRESENCE_STATUSES)[number] {
  return s != null && PRESENCE_STATUSES.includes(s as (typeof PRESENCE_STATUSES)[number]);
}

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
type MessageLike = {
  id?: string;
  channelId?: string;
  channel?: { name?: string; guild?: { id: string } };
  author?: { id: string; username?: string; tag?: string; discriminator?: string; avatar?: string | null };
  content?: string;
};
type VoiceStateLike = {
  guild: { id: string };
  channelId: string | null;
  channel?: { id?: string; name?: string } | null;
  member?: { user: { id: string; tag?: string } };
};
type GuildMemberUpdateLike = { guild: { id: string }; roles: { cache: Map<string, { name: string }> }; user: { id: string; tag?: string } };

function safeToJson(obj: unknown): Record<string, unknown> {
  if (obj == null) return {};
  const o = obj as { toJSON?: () => unknown };
  if (typeof o.toJSON === 'function') {
    try {
      const out = o.toJSON();
      if (out != null && typeof out === 'object' && !Array.isArray(out)) return out as Record<string, unknown>;
    } catch {
      // ignore
    }
  }
  return {};
}

function serializeAuthor(
  author: { id?: string; username?: string; tag?: string; discriminator?: string; avatar?: string | null } | null | undefined,
): Record<string, unknown> {
  if (author == null) return {};
  return {
    id: author.id,
    username: author.username ?? (author.tag ? author.tag.split('#')[0] : undefined),
    tag: author.tag,
    discriminator: author.discriminator,
    avatar: author.avatar ?? undefined,
  };
}

function enrichMessageData(base: Record<string, unknown>, message: MessageLike): Record<string, unknown> {
  const author = serializeAuthor(message.author);
  if (Object.keys(author).length === 0) return base;
  return { ...base, author: { ...(base.author != null && typeof base.author === 'object' ? (base.author as Record<string, unknown>) : {}), ...author } };
}

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

  type WelcomeGoodbyeSettingCache = {
    channelId: string | null;
    enabled: boolean;
    messageType: string;
    contentText: string | null;
    contentEmbed: { title?: string; description?: string; color?: number; fields?: { name: string; value: string }[] } | null;
  };

  async function getWelcomeGoodbyeSettings(guildId: string): Promise<{ welcome: WelcomeGoodbyeSettingCache; goodbye: WelcomeGoodbyeSettingCache }> {
    const cacheKey = `${redisPrefix}${WELCOME_GOODBYE_CACHE_PREFIX}${guildId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as { welcome: WelcomeGoodbyeSettingCache; goodbye: WelcomeGoodbyeSettingCache };
      } catch {
        // fall through
      }
    }
    const repo = AppDataSource.getRepository(GuildWelcomeGoodbyeSetting);
    const rows = await repo.find({ where: { guildId } });
    const defaultSetting: WelcomeGoodbyeSettingCache = { channelId: null, enabled: false, messageType: 'text', contentText: null, contentEmbed: null };
    const welcomeRow = rows.find((r) => r.type === 'welcome') ?? null;
    const goodbyeRow = rows.find((r) => r.type === 'goodbye') ?? null;
    return {
      welcome: welcomeRow ? { channelId: welcomeRow.channelId, enabled: welcomeRow.enabled, messageType: welcomeRow.messageType, contentText: welcomeRow.contentText, contentEmbed: welcomeRow.contentEmbed } : defaultSetting,
      goodbye: goodbyeRow ? { channelId: goodbyeRow.channelId, enabled: goodbyeRow.enabled, messageType: goodbyeRow.messageType, contentText: goodbyeRow.contentText, contentEmbed: goodbyeRow.contentEmbed } : defaultSetting,
    };
  }

  function buildPlaceholderContext(
    user: { id?: string | null; username?: string | null; tag?: string | null } | null | undefined,
    guildName: string,
    memberCount: number,
  ): WelcomeGoodbyePlaceholderContext {
    const userId = user?.id ?? '';
    const userTag = user?.tag ?? user?.username ?? UNKNOWN_USER;
    const username = userTag;
    const userMention = userId ? `<@${userId}>` : UNKNOWN_USER;
    return { userMention, username, userTag, userId, serverName: guildName, memberCount: String(memberCount) };
  }

  function buildWelcomeGoodbyeMessage(
    setting: WelcomeGoodbyeSettingCache,
    context: WelcomeGoodbyePlaceholderContext,
  ): { content: string | null; embed: ReturnType<EmbedBuilder['toJSON']> | null } {
    const contentText = setting.messageType === 'embed' ? null : replacePlaceholders(setting.contentText ?? '', context);
    const hasEmbed = (setting.messageType === 'embed' || setting.messageType === 'text_and_embed') && setting.contentEmbed;
    let embed: ReturnType<EmbedBuilder['toJSON']> | null = null;
    if (hasEmbed && setting.contentEmbed) {
      const e = setting.contentEmbed;
      const title = e.title != null ? replacePlaceholders(e.title, context).slice(0, EMBED_TITLE_MAX) : undefined;
      const description = e.description != null ? replacePlaceholders(e.description, context).slice(0, EMBED_DESCRIPTION_MAX) : undefined;
      const embedBuilder = new EmbedBuilder();
      if (title) embedBuilder.setTitle(title);
      if (description) embedBuilder.setDescription(description);
      if (e.color != null) embedBuilder.setColor(e.color);
      if (e.fields?.length) {
        for (const f of e.fields) {
          embedBuilder.addFields({
            name: replacePlaceholders(f.name, context).slice(0, EMBED_FIELD_NAME_MAX),
            value: replacePlaceholders(f.value, context).slice(0, EMBED_FIELD_VALUE_MAX),
          });
        }
      }
      embed = embedBuilder.toJSON();
    }
    return { content: contentText || null, embed };
  }

  async function sendWelcomeMessage(
    guildId: string,
    member: GuildMemberLike & { guild: { memberCount: number; name?: string } },
    memberCount: number,
  ): Promise<void> {
    const settings = await getWelcomeGoodbyeSettings(guildId);
    const welcome = settings.welcome;
    if (!welcome.enabled || !welcome.channelId) return;
    const channel = await fetchChannel(welcome.channelId);
    if (!channel) return;
    const guildName = (member.guild as { name?: string }).name ?? '';
    const context = buildPlaceholderContext(member.user, guildName, memberCount);
    const { content, embed } = buildWelcomeGoodbyeMessage(welcome, context);
    const payload: { content?: string; embeds?: unknown[] } = {};
    if (content) payload.content = content;
    if (embed) payload.embeds = [embed];
    if (payload.content || payload.embeds?.length) {
      await (channel as { send: (opts: { content?: string; embeds?: unknown[] }) => Promise<unknown> }).send(payload).catch((err: unknown) => {
        console.error(`[shard-events] send welcome error: ${(err as Error).message}`);
      });
    }
  }

  async function sendGoodbyeMessage(
    guildId: string,
    member: GuildMemberLike & { guild: { name?: string } },
    memberCount: number,
  ): Promise<void> {
    const settings = await getWelcomeGoodbyeSettings(guildId);
    const goodbye = settings.goodbye;
    if (!goodbye.enabled || !goodbye.channelId) return;
    const channel = await fetchChannel(goodbye.channelId);
    if (!channel) return;
    const guildName = (member.guild as { name?: string }).name ?? '';
    const context = buildPlaceholderContext(member.user, guildName, memberCount);
    const { content, embed } = buildWelcomeGoodbyeMessage(goodbye, context);
    const payload: { content?: string; embeds?: unknown[] } = {};
    if (content) payload.content = content;
    if (embed) payload.embeds = [embed];
    if (payload.content || payload.embeds?.length) {
      await (channel as { send: (opts: { content?: string; embeds?: unknown[] }) => Promise<unknown> }).send(payload).catch((err: unknown) => {
        console.error(`[shard-events] send goodbye error: ${(err as Error).message}`);
      });
    }
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
    logEventType?: string,
  ): Promise<void> {
    if (!guildId) return;
    const eventId = randomUUID();
    const rawPayload: RawEventJobPayload = {
      eventId,
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
      return;
    }

    const logType = logEventType ?? eventType;
    const settings = await getLogSettings(guildId);
    const setting = settings.get(logType);
    if (!setting?.enabled || !setting.channelId) {
      console.log(`[analytics] skip enqueue: no log channel eventType=${eventType} guildId=${guildId}`);
      return;
    }

    const channel = await fetchChannel(setting.channelId);
    if (!channel) {
      console.log(`[analytics] skip enqueue: log channel unreachable eventType=${eventType} guildId=${guildId}`);
      return;
    }

    const embedData = buildLogEmbedData(logType, embedPayload);
    const embed = embedFromData(embedData);
    await channel.send({ embeds: [embed] }).catch((err) => {
      console.error(`[shard-events] send log error: ${(err as Error).message}`);
    });

    console.log(`[analytics] enqueue eventType=${eventType} guildId=${guildId} eventId=${eventId}`);
    await rawEventsQueue.add(eventType, rawPayload, { priority: 0 }).catch((err) => {
      console.error(`[shard-events] raw-events enqueue error: ${(err as Error).message}`);
    });
  }

  async function touchGuildLastActivity(discordGuildId: string): Promise<void> {
    const guildRepo = AppDataSource.getRepository(Guild);
    const guild = await guildRepo.findOne({ where: { discordGuildId }, select: ['id', 'discordGuildId'] });
    await guildRepo
      .update({ discordGuildId }, { lastActivity: new Date() })
      .catch(() => {});
    if (guild?.id) {
      console.log(`[realtime] Discord → Redis guildId=${guild.id} parameter=lastActivity`);
      publishGuildStateEvent(redis, redisPrefix, {
        guildId: guild.id,
        discordGuildId: guild.discordGuildId,
        parameter: 'lastActivity',
        direction: 'set',
        value: new Date().toISOString(),
      });
    }
  }

  async function updateMemberCountAndCounters(discordGuildId: string, guildId: string | null, memberCount: number): Promise<void> {
    if (!guildId) return;
    const key = `${redisPrefix}${MEMBER_COUNT_CACHE_PREFIX}${guildId}${MEMBER_COUNT_SUFFIX}`;
    await redis.set(key, String(memberCount)).catch(() => {});

    const guildRepo = AppDataSource.getRepository(Guild);
    await guildRepo.update({ discordGuildId }, { memberCount }).catch(() => {});

    console.log(`[realtime] Discord → Redis guildId=${guildId} parameter=memberCount`);
    publishGuildStateEvent(redis, redisPrefix, {
      guildId,
      discordGuildId,
      parameter: 'memberCount',
      direction: 'set',
      value: memberCount,
    });

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
        role_id: c.roleId ?? undefined,
      } as CounterUpdateJobPayload, { priority: 0 }).catch(() => {});
    }
  }

  async function updateRoleCountsAndEnqueueRoleCounters(guildId: string, roleIds: string[]): Promise<void> {
    if (roleIds.length === 0) return;
    const counterRepo = AppDataSource.getRepository(Counter);
    const counters = await counterRepo.find({
      where: { guildId, metric: CounterMetric.ROLE, roleId: In(roleIds) },
      select: ['id', 'guildId', 'channelId', 'type', 'metric', 'roleId'],
    });
    for (const c of counters) {
      await countersQueue.add('update', {
        counter_id: c.id,
        guild_id: c.guildId,
        channel_id: c.channelId,
        type: c.type,
        metric: c.metric,
        role_id: c.roleId ?? undefined,
      } as CounterUpdateJobPayload, { priority: 0 }).catch(() => {});
    }
  }

  function getRoleIdsFromMember(member: { guild: { id: string }; roles?: { cache: Map<string, unknown> } }): string[] {
    const cache = member.roles?.cache;
    if (!cache) return [];
    return Array.from(cache.keys()).filter((id) => id !== member.guild.id);
  }

  return {
    async onGuildMemberAdd(member: GuildMemberLike & { guild: { memberCount: number }; roles?: { cache: Map<string, unknown> } }): Promise<void> {
      const discordGuildId = member.guild.id;
      const guildId = await getGuildId(discordGuildId);
      const memberCount = member.guild.memberCount ?? 0;

      await updateMemberCountAndCounters(discordGuildId, guildId, memberCount);
      if (guildId) touchGuildLastActivity(discordGuildId).catch(() => {});

      const roleIds = getRoleIdsFromMember(member);
      if (guildId && roleIds.length > 0) {
        const roleKey = `${redisPrefix}${MEMBER_COUNT_CACHE_PREFIX}${guildId}${ROLE_COUNTS_CACHE_SUFFIX}`;
        for (const roleId of roleIds) {
          await redis.hincrby(roleKey, roleId, 1).catch(() => {});
        }
        await updateRoleCountsAndEnqueueRoleCounters(guildId, roleIds);
      }

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
      if (guildId) {
        publishDiscordEvent(redis, redisPrefix, {
          guildId,
          discordGuildId,
          eventType: 'GUILD_MEMBER_ADD',
          data: safeToJson(member),
        });
        sendWelcomeMessage(guildId, member, memberCount).catch(() => {});
      }
    },

    async onGuildMemberRemove(member: GuildMemberLike & { roles?: { cache: Map<string, unknown> } }): Promise<void> {
      const discordGuildId = member.guild.id;
      const guildId = await getGuildId(discordGuildId);
      const memberCount = typeof member.guild.memberCount === 'number' ? member.guild.memberCount : 0;

      await updateMemberCountAndCounters(discordGuildId, guildId, memberCount);
      if (guildId) touchGuildLastActivity(discordGuildId).catch(() => {});

      const roleIds = getRoleIdsFromMember(member);
      if (guildId && roleIds.length > 0) {
        const roleKey = `${redisPrefix}${MEMBER_COUNT_CACHE_PREFIX}${guildId}${ROLE_COUNTS_CACHE_SUFFIX}`;
        for (const roleId of roleIds) {
          await redis.hincrby(roleKey, roleId, -1).catch(() => {});
        }
        await updateRoleCountsAndEnqueueRoleCounters(guildId, roleIds);
      }

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
      if (guildId) {
        publishDiscordEvent(redis, redisPrefix, {
          guildId,
          discordGuildId,
          eventType: 'GUILD_MEMBER_REMOVE',
          data: safeToJson(member),
        });
        sendGoodbyeMessage(guildId, member, memberCount).catch(() => {});
      }
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
      if (guildId) {
        publishDiscordEvent(redis, redisPrefix, {
          guildId,
          discordGuildId,
          eventType: 'MESSAGE_DELETE',
          data: enrichMessageData(safeToJson(message), message),
        });
      }
    },

    async onMessageCreate(message: MessageLike): Promise<void> {
      const channel = message.channel as { guild?: { id: string } } | undefined;
      const discordGuildId = channel?.guild?.id;
      if (!discordGuildId) return;
      const guildId = await getGuildId(discordGuildId);
      if (guildId) {
        console.log(`[analytics] MESSAGE_CREATE guildId=${guildId} discordGuildId=${discordGuildId}`);
        touchGuildLastActivity(discordGuildId).catch(() => {});
      } else {
        console.log(`[analytics] MESSAGE_CREATE skip: guild not in DB discordGuildId=${discordGuildId}`);
      }

      await sendLogAndIngest(
        discordGuildId,
        guildId,
        'MESSAGE_CREATE',
        {
          messageId: message.id,
          channelId: message.channelId,
          userId: message.author?.id,
          avatar: (message.author as { avatar?: string | null })?.avatar ?? undefined,
        },
        {
          channelName: (message.channel as { name?: string })?.name ?? undefined,
          userTag: message.author?.tag ?? undefined,
          userId: message.author?.id ?? undefined,
          messageContent: message.content ?? undefined,
          timestamp: new Date().toISOString(),
        },
        {
          channelId: message.channelId,
          discordUserId: message.author?.id,
        },
        'message_create',
      );
      if (guildId) {
        const countKey = `${redisPrefix}${MESSAGE_COUNT_CACHE_PREFIX}${guildId}`;
        const newTotal = await redis.incr(countKey).catch(() => 0);
        // Не публикуем при newTotal===1: ключ мог отсутствовать (Redis restart), тогда INCR даёт 1 вместо реального total.
        // Ingestor после flush публикует корректное значение из ClickHouse.
        if (newTotal > 1) {
          publishGuildStateEvent(redis, redisPrefix, {
            guildId,
            discordGuildId,
            parameter: 'totalMessages',
            direction: 'set',
            value: newTotal,
          });
        }
        publishDiscordEvent(redis, redisPrefix, {
          guildId,
          discordGuildId,
          eventType: 'MESSAGE_CREATE',
          data: enrichMessageData(safeToJson(message), message),
        });
      }
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
      if (guildId) {
        publishDiscordEvent(redis, redisPrefix, {
          guildId,
          discordGuildId,
          eventType: 'MESSAGE_UPDATE',
          data: {
            old: enrichMessageData(safeToJson(oldMessage), oldMessage),
            new: enrichMessageData(safeToJson(newMessage), newMessage),
          },
        });
      }
    },

    async onVoiceStateUpdate(oldState: VoiceStateLike, newState: VoiceStateLike): Promise<void> {
      const discordGuildId = oldState.guild.id;
      const guildId = await getGuildId(discordGuildId);
      if (guildId) {
        touchGuildLastActivity(discordGuildId).catch(() => {});
        const voiceKey = `${redisPrefix}${VOICE_COUNT_CACHE_PREFIX}${guildId}`;
        if (oldState.channelId) {
          await redis.decr(voiceKey).catch(() => {});
        }
        if (newState.channelId) {
          await redis.incr(voiceKey).catch(() => {});
        }
        const rawCount = await redis.get(voiceKey).catch(() => null);
        const voiceOnline = rawCount != null ? Math.max(0, parseInt(rawCount, 10)) : 0;
        console.log(`[realtime] Discord → Redis guildId=${guildId} parameter=voiceOnline`);
        publishGuildStateEvent(redis, redisPrefix, {
          guildId,
          discordGuildId,
          parameter: 'voiceOnline',
          direction: 'set',
          value: voiceOnline,
        });
        publishDiscordEvent(redis, redisPrefix, {
          guildId,
          discordGuildId,
          eventType: 'VOICE_STATE_UPDATE',
          data: { old: safeToJson(oldState), new: safeToJson(newState) },
        });
      }

      const voiceChannelName = (newState.channel ?? oldState.channel)?.name ?? undefined;
      const discordUserId = (newState.member ?? oldState.member)?.user?.id;
      const channelId =
        (newState.channel ?? oldState.channel)?.id ??
        newState.channelId ??
        oldState.channelId ??
        null;

      const voiceMember = newState.member ?? oldState.member;
      await sendLogAndIngest(
        discordGuildId,
        guildId,
        'voice_change',
        {
          userId: discordUserId,
          userTag: voiceMember?.user?.tag,
          avatar: (voiceMember?.user as { avatar?: string | null } | undefined)?.avatar ?? undefined,
          voiceChannelName,
          channelId: channelId ?? undefined,
          timestamp: new Date().toISOString(),
        },
        {
          userTag: voiceMember?.user?.tag ?? undefined,
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
      const oldRoleIds = Array.from(oldMember.roles.cache?.keys() ?? []).filter((id) => id !== oldMember.guild.id);
      const newRoleIds = Array.from(newMember.roles.cache?.keys() ?? []).filter((id) => id !== (newMember as { guild?: { id: string } }).guild?.id);
      if (guildId) {
        const roleKey = `${redisPrefix}${MEMBER_COUNT_CACHE_PREFIX}${guildId}${ROLE_COUNTS_CACHE_SUFFIX}`;
        for (const roleId of oldRoleIds) {
          if (!newRoleIds.includes(roleId)) {
            await redis.hincrby(roleKey, roleId, -1).catch(() => {});
          }
        }
        for (const roleId of newRoleIds) {
          if (!oldRoleIds.includes(roleId)) {
            await redis.hincrby(roleKey, roleId, 1).catch(() => {});
          }
        }
        const affectedRoleIds = [...oldRoleIds.filter((id) => !newRoleIds.includes(id)), ...newRoleIds.filter((id) => !oldRoleIds.includes(id))];
        if (affectedRoleIds.length > 0) {
          await updateRoleCountsAndEnqueueRoleCounters(guildId, affectedRoleIds);
        }
        publishDiscordEvent(redis, redisPrefix, {
          guildId,
          discordGuildId,
          eventType: 'GUILD_MEMBER_UPDATE',
          data: { old: safeToJson(oldMember), new: safeToJson(newMember) },
        });
      }

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

    async onPresenceUpdate(
      oldPresence: { guild?: { id: string }; status?: string } | null,
      newPresence: { guild?: { id: string }; status?: string },
    ): Promise<void> {
      const discordGuildId = newPresence.guild?.id ?? oldPresence?.guild?.id;
      if (!discordGuildId) return;
      const guildId = await getGuildId(discordGuildId);
      if (!guildId) return;

      const oldStatus = oldPresence?.status ?? null;
      const newStatus = newPresence?.status ?? null;
      const key = `${redisPrefix}${PRESENCE_CACHE_PREFIX}${guildId}`;
      if (isPresenceStatus(oldStatus)) {
        await redis.hincrby(key, oldStatus, -1).catch(() => {});
      }
      if (isPresenceStatus(newStatus)) {
        await redis.hincrby(key, newStatus, 1).catch(() => {});
      }

      const presenceHash = (await redis.hgetall(key).catch(() => ({}))) as Record<string, string>;
      const onlineMembers =
        (PRESENCE_STATUSES as readonly string[]).slice(0, -1).reduce(
          (sum, status) => sum + Math.max(0, parseInt(presenceHash[status] ?? '0', 10)),
          0,
        );
      const lastKey = `${redisPrefix}${ONLINE_MEMBERS_LAST_PREFIX}${guildId}`;
      const lastRaw = await redis.get(lastKey).catch(() => null);
      const lastValue = lastRaw != null ? parseInt(lastRaw, 10) : null;
      if (lastValue !== onlineMembers) {
        await redis.set(lastKey, String(onlineMembers)).catch(() => {});
        publishGuildStateEvent(redis, redisPrefix, {
          guildId,
          discordGuildId,
          parameter: 'onlineMembers',
          direction: 'set',
          value: onlineMembers,
        });
      }

      const counterRepo = AppDataSource.getRepository(Counter);
      const counters = await counterRepo.find({
        where: { guildId, metric: In([CounterMetric.ONLINE, CounterMetric.IDLE, CounterMetric.DND, CounterMetric.OFFLINE]) },
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
      publishDiscordEvent(redis, redisPrefix, {
        guildId,
        discordGuildId,
        eventType: 'PRESENCE_UPDATE',
        data: { old: safeToJson(oldPresence), new: safeToJson(newPresence) },
      });
    },

    destroy(): Promise<void> {
      return Promise.all([rawEventsQueue.close(), countersQueue.close()]).then(() => undefined);
    },
  };
}
