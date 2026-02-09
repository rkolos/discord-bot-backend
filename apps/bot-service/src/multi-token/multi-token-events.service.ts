import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmbedBuilder } from 'discord.js';
import { randomUUID } from 'crypto';
import type { Client, GuildMember, Message, PartialMessage, Presence, ThreadChannel, VoiceState, PartialGuildMember } from 'discord.js';
import {
  Guild,
  GuildLogSetting,
  GuildWelcomeGoodbyeSetting,
  buildLogEmbedData,
  RedisService,
  SharedConfigService,
  publishGuildStateEvent,
  publishDiscordEvent,
  replacePlaceholders,
  type WelcomeGoodbyePlaceholderContext,
} from '@app/shared';
import { RawEventsQueueService } from '../raw-events/raw-events-queue.service';
import { CountersQueueProducerService } from '../counters-queue-producer/counters-queue-producer.service';
import type { RawEventJobPayload } from '../raw-events/raw-events-queue.types';

const MEMBER_COUNT_CACHE_PREFIX = 'bot-service:cache:guild:';
const MEMBER_COUNT_SUFFIX = ':member_count';
const ROLE_COUNTS_CACHE_SUFFIX = ':role_counts';
const LOG_SETTINGS_CACHE_PREFIX = 'bot-service:cache:log-settings:';
const WELCOME_GOODBYE_CACHE_PREFIX = 'bot-service:cache:welcome-goodbye:';
const PRESENCE_CACHE_PREFIX = 'bot-service:presence:';
const VOICE_COUNT_CACHE_PREFIX = 'bot-service:voice-count:';
const ONLINE_MEMBERS_LAST_PREFIX = 'bot-service:guild-state:online-members:';

const EMBED_TITLE_MAX = 256;
const EMBED_DESCRIPTION_MAX = 4096;
const EMBED_FIELD_NAME_MAX = 256;
const EMBED_FIELD_VALUE_MAX = 1024;
const UNKNOWN_USER = 'Unknown User';

const PRESENCE_STATUSES = ['online', 'idle', 'dnd', 'offline'] as const;
function isPresenceStatus(s: string | null | undefined): s is (typeof PRESENCE_STATUSES)[number] {
  return s != null && PRESENCE_STATUSES.includes(s as (typeof PRESENCE_STATUSES)[number]);
}

@Injectable()
export class MultiTokenEventsService {
  private readonly logger = new Logger(MultiTokenEventsService.name);

  constructor(
    @InjectRepository(Guild)
    private readonly guildRepository: Repository<Guild>,
    @InjectRepository(GuildLogSetting)
    private readonly logSettingsRepository: Repository<GuildLogSetting>,
    @InjectRepository(GuildWelcomeGoodbyeSetting)
    private readonly welcomeGoodbyeSettingsRepository: Repository<GuildWelcomeGoodbyeSetting>,
    private readonly sharedConfig: SharedConfigService,
    private readonly redisService: RedisService,
    private readonly rawEventsQueue: RawEventsQueueService,
    private readonly countersQueueProducer: CountersQueueProducerService,
  ) {}

  private safeToJson(obj: unknown): Record<string, unknown> {
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

  private serializeAuthor(
    author: { id?: string; username?: string; tag?: string; discriminator?: string; avatar?: string | null } | null | undefined,
  ): Record<string, unknown> {
    if (author == null) return {};
    return {
      id: author.id,
      username: author.username ?? author.tag?.split('#')[0],
      tag: author.tag,
      discriminator: author.discriminator,
      avatar: author.avatar ?? undefined,
    };
  }

  private enrichMessageData(
    base: Record<string, unknown>,
    message: { author?: { id?: string; username?: string; tag?: string; discriminator?: string; avatar?: string | null } | null },
  ): Record<string, unknown> {
    const author = this.serializeAuthor(message.author);
    if (Object.keys(author).length === 0) return base;
    return { ...base, author: { ...(base.author != null && typeof base.author === 'object' ? (base.author as Record<string, unknown>) : {}), ...author } };
  }

  private async getLogSettings(guildId: string): Promise<Map<string, { channelId: string | null; enabled: boolean }>> {
    const prefix = this.sharedConfig.redis.prefix;
    const cacheKey = `${prefix}${LOG_SETTINGS_CACHE_PREFIX}${guildId}`;
    const redis = this.redisService.getClient();
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        const obj = JSON.parse(cached) as Record<string, { channelId: string | null; enabled: boolean }>;
        return new Map(Object.entries(obj));
      } catch {
        // fall through
      }
    }
    const rows = await this.logSettingsRepository.find({ where: { guildId } });
    const map = new Map<string, { channelId: string | null; enabled: boolean }>();
    for (const r of rows) {
      map.set(r.eventType, { channelId: r.channelId, enabled: r.enabled });
    }
    return map;
  }

  private async getWelcomeGoodbyeSettings(guildId: string): Promise<{
    welcome: { channelId: string | null; enabled: boolean; messageType: string; contentText: string | null; contentEmbed: { title?: string; description?: string; color?: number; fields?: { name: string; value: string }[] } | null };
    goodbye: { channelId: string | null; enabled: boolean; messageType: string; contentText: string | null; contentEmbed: { title?: string; description?: string; color?: number; fields?: { name: string; value: string }[] } | null };
  }> {
    const prefix = this.sharedConfig.redis.prefix;
    const cacheKey = `${prefix}${WELCOME_GOODBYE_CACHE_PREFIX}${guildId}`;
    const redis = this.redisService.getClient();
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as {
          welcome: { channelId: string | null; enabled: boolean; messageType: string; contentText: string | null; contentEmbed: { title?: string; description?: string; color?: number; fields?: { name: string; value: string }[] } | null };
          goodbye: { channelId: string | null; enabled: boolean; messageType: string; contentText: string | null; contentEmbed: { title?: string; description?: string; color?: number; fields?: { name: string; value: string }[] } | null };
        };
      } catch {
        // fall through
      }
    }
    const rows = await this.welcomeGoodbyeSettingsRepository.find({ where: { guildId } });
    const welcomeRow = rows.find((r) => r.type === 'welcome') ?? null;
    const goodbyeRow = rows.find((r) => r.type === 'goodbye') ?? null;
    const defaultSetting = { channelId: null as string | null, enabled: false, messageType: 'text', contentText: null as string | null, contentEmbed: null as { title?: string; description?: string; color?: number; fields?: { name: string; value: string }[] } | null };
    return {
      welcome: welcomeRow ? { channelId: welcomeRow.channelId, enabled: welcomeRow.enabled, messageType: welcomeRow.messageType, contentText: welcomeRow.contentText, contentEmbed: welcomeRow.contentEmbed } : defaultSetting,
      goodbye: goodbyeRow ? { channelId: goodbyeRow.channelId, enabled: goodbyeRow.enabled, messageType: goodbyeRow.messageType, contentText: goodbyeRow.contentText, contentEmbed: goodbyeRow.contentEmbed } : defaultSetting,
    };
  }

  private buildPlaceholderContext(
    user: { id?: string | null; username?: string | null; tag?: string | null; displayName?: string | null } | null | undefined,
    guildName: string,
    memberCount: number,
  ): WelcomeGoodbyePlaceholderContext {
    const userId = user?.id ?? '';
    const userTag = user?.tag ?? user?.username ?? UNKNOWN_USER;
    const username = (user as { displayName?: string | null })?.displayName ?? userTag;
    const userMention = userId ? `<@${userId}>` : UNKNOWN_USER;
    return {
      userMention,
      username,
      userTag,
      userId,
      serverName: guildName,
      memberCount: String(memberCount),
    };
  }

  private buildWelcomeGoodbyeMessage(
    setting: { messageType: string; contentText: string | null; contentEmbed: { title?: string; description?: string; color?: number; fields?: { name: string; value: string }[] } | null },
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

  private async sendWelcomeMessage(
    client: Client<true>,
    guildId: string,
    member: GuildMember,
    memberCount: number,
  ): Promise<void> {
    const settings = await this.getWelcomeGoodbyeSettings(guildId);
    const welcome = settings.welcome;
    if (!welcome.enabled || !welcome.channelId) return;
    const channel = await client.channels.fetch(welcome.channelId).catch(() => null);
    if (!channel || !('send' in channel)) return;
    const context = this.buildPlaceholderContext(member.user, member.guild.name, memberCount);
    const { content, embed } = this.buildWelcomeGoodbyeMessage(welcome, context);
    const payload: { content?: string; embeds?: unknown[] } = {};
    if (content) payload.content = content;
    if (embed) payload.embeds = [embed];
    if (payload.content || payload.embeds?.length) {
      await (channel as { send: (opts: { content?: string; embeds?: unknown[] }) => Promise<unknown> }).send(payload).catch(() => {});
    }
  }

  private async sendGoodbyeMessage(
    client: Client<true>,
    guildId: string,
    member: GuildMember | PartialGuildMember,
    memberCount: number,
  ): Promise<void> {
    const settings = await this.getWelcomeGoodbyeSettings(guildId);
    const goodbye = settings.goodbye;
    if (!goodbye.enabled || !goodbye.channelId) return;
    const channel = await client.channels.fetch(goodbye.channelId).catch(() => null);
    if (!channel || !('send' in channel)) return;
    const user = member.user;
    const guildName = member.guild.name ?? '';
    const context = this.buildPlaceholderContext(user, guildName, memberCount);
    const { content, embed } = this.buildWelcomeGoodbyeMessage(goodbye, context);
    const payload: { content?: string; embeds?: unknown[] } = {};
    if (content) payload.content = content;
    if (embed) payload.embeds = [embed];
    if (payload.content || payload.embeds?.length) {
      await (channel as { send: (opts: { content?: string; embeds?: unknown[] }) => Promise<unknown> }).send(payload).catch(() => {});
    }
  }

  private async sendLogAndIngest(
    client: Client<true>,
    guildId: string,
    discordGuildId: string,
    eventType: string,
    payload: Record<string, unknown>,
    embedPayload: Parameters<typeof buildLogEmbedData>[1],
  ): Promise<void> {
    const settings = await this.getLogSettings(guildId);
    const setting = settings.get(eventType);
    if (!setting?.enabled || !setting.channelId) return;

    const channel = await client.channels.fetch(setting.channelId).catch(() => null);
    if (!channel || !('send' in channel)) return;

    const embedData = buildLogEmbedData(eventType, embedPayload);
    const embed = new EmbedBuilder().setTitle(embedData.title);
    if (embedData.description) embed.setDescription(embedData.description);
    for (const f of embedData.fields) {
      embed.addFields({ name: f.name, value: f.value });
    }
    await (channel as { send: (opts: { embeds: unknown[] }) => Promise<unknown> }).send({ embeds: [embed] }).catch(() => {});

    const rawPayload: RawEventJobPayload = {
      eventId: randomUUID(),
      eventType,
      eventTime: new Date().toISOString(),
      guildId,
      discordGuildId,
      payload,
    };
    await this.rawEventsQueue.addRawEvent(rawPayload).catch(() => {});
  }

  async onGuildMemberAdd(member: GuildMember, client: Client<true>): Promise<void> {
    const discordGuildId = member.guild.id;
    const guildId = await this.getGuildIdByDiscordId(discordGuildId);
    if (!guildId) return;

    const memberCount = member.guild.memberCount ?? 0;
    const prefix = this.sharedConfig.redis.prefix;
    const key = `${prefix}${MEMBER_COUNT_CACHE_PREFIX}${guildId}${MEMBER_COUNT_SUFFIX}`;
    await this.redisService.getClient().set(key, String(memberCount)).catch(() => {});

    await this.countersQueueProducer.addCounterUpdatesForGuildMembers(guildId);

    const roleIds = Array.from(member.roles.cache?.keys() ?? []).filter((id) => id !== member.guild.id);
    if (roleIds.length > 0) {
      const roleKey = `${prefix}${MEMBER_COUNT_CACHE_PREFIX}${guildId}${ROLE_COUNTS_CACHE_SUFFIX}`;
      const redis = this.redisService.getClient();
      for (const roleId of roleIds) {
        await redis.hincrby(roleKey, roleId, 1).catch(() => {});
      }
      await this.countersQueueProducer.addCounterUpdatesForGuildRoles(guildId, roleIds);
    }

    this.logger.log(`[realtime] Discord → Redis guildId=${guildId} parameter=memberCount (member_join)`);
    publishGuildStateEvent(this.redisService.getClient(), this.sharedConfig.redis.prefix, {
      guildId,
      discordGuildId,
      parameter: 'memberCount',
      direction: 'set',
      value: memberCount,
    });
    await this.sendLogAndIngest(
      client,
      guildId,
      discordGuildId,
      'member_join',
      {
        userId: member.user?.id,
        userTag: member.user?.tag,
        avatar: (member.user as { avatar?: string | null })?.avatar ?? undefined,
      },
      {
        userTag: member.user?.tag ?? undefined,
        userId: member.user?.id ?? undefined,
        timestamp: new Date().toISOString(),
      },
    );
    await this.sendWelcomeMessage(client, guildId, member, memberCount);
    publishDiscordEvent(this.redisService.getClient(), this.sharedConfig.redis.prefix, {
      guildId,
      discordGuildId,
      eventType: 'GUILD_MEMBER_ADD',
      data: this.safeToJson(member),
    });
  }

  async onGuildMemberRemove(member: GuildMember | PartialGuildMember, client: Client<true>): Promise<void> {
    const discordGuildId = member.guild.id;
    const guildId = await this.getGuildIdByDiscordId(discordGuildId);
    if (!guildId) return;

    const memberCount = 'memberCount' in member.guild && typeof member.guild.memberCount === 'number' ? member.guild.memberCount : 0;
    const prefix = this.sharedConfig.redis.prefix;
    const key = `${prefix}${MEMBER_COUNT_CACHE_PREFIX}${guildId}${MEMBER_COUNT_SUFFIX}`;
    await this.redisService.getClient().set(key, String(memberCount)).catch(() => {});

    await this.countersQueueProducer.addCounterUpdatesForGuildMembers(guildId);

    const roleIds = Array.from(member.roles.cache?.keys() ?? []).filter((id) => id !== member.guild.id);
    if (roleIds.length > 0) {
      const roleKey = `${prefix}${MEMBER_COUNT_CACHE_PREFIX}${guildId}${ROLE_COUNTS_CACHE_SUFFIX}`;
      const redis = this.redisService.getClient();
      for (const roleId of roleIds) {
        await redis.hincrby(roleKey, roleId, -1).catch(() => {});
      }
      await this.countersQueueProducer.addCounterUpdatesForGuildRoles(guildId, roleIds);
    }

    this.logger.log(`[realtime] Discord → Redis guildId=${guildId} parameter=memberCount (member_leave)`);
    publishGuildStateEvent(this.redisService.getClient(), this.sharedConfig.redis.prefix, {
      guildId,
      discordGuildId,
      parameter: 'memberCount',
      direction: 'set',
      value: memberCount,
    });
    const user = member.user;
    await this.sendLogAndIngest(
      client,
      guildId,
      discordGuildId,
      'member_leave',
      {
        userId: user?.id,
        userTag: user?.tag,
        avatar: (user as { avatar?: string | null })?.avatar ?? undefined,
      },
      {
        userTag: user?.tag ?? undefined,
        userId: user?.id ?? undefined,
        timestamp: new Date().toISOString(),
      },
    );
    await this.sendGoodbyeMessage(client, guildId, member, memberCount);
    publishDiscordEvent(this.redisService.getClient(), this.sharedConfig.redis.prefix, {
      guildId,
      discordGuildId,
      eventType: 'GUILD_MEMBER_REMOVE',
      data: this.safeToJson(member),
    });
  }

  async onMessageDelete(message: Message | PartialMessage, client: Client<true>): Promise<void> {
    const channel = message.channel;
    const guild = channel && 'guild' in channel ? (channel as { guild: { id: string } }).guild : null;
    if (!guild) return;
    const discordGuildId = guild.id;
    const guildId = await this.getGuildIdByDiscordId(discordGuildId);
    if (!guildId) return;

    await this.sendLogAndIngest(
      client,
      guildId,
      discordGuildId,
      'message_delete',
      {
        messageId: message.id,
        channelId: message.channelId,
        userId: message.author?.id,
        avatar: (message.author as { avatar?: string | null })?.avatar ?? undefined,
      },
      {
        channelName: channel && 'name' in channel ? (channel as { name: string }).name : undefined,
        userTag: message.author?.tag ?? undefined,
        userId: message.author?.id ?? undefined,
        messageContent: message.content ?? undefined,
        timestamp: new Date().toISOString(),
      },
    );
    publishDiscordEvent(this.redisService.getClient(), this.sharedConfig.redis.prefix, {
      guildId,
      discordGuildId,
      eventType: 'MESSAGE_DELETE',
      data: this.enrichMessageData(this.safeToJson(message), message),
    });
  }

  async onMessageUpdate(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage, client: Client<true>): Promise<void> {
    const channel = oldMessage.channel;
    const guild = channel && 'guild' in channel ? (channel as { guild: { id: string } }).guild : null;
    if (!guild) return;
    const discordGuildId = guild.id;
    const guildId = await this.getGuildIdByDiscordId(discordGuildId);
    if (!guildId) return;

    await this.sendLogAndIngest(
      client,
      guildId,
      discordGuildId,
      'message_edit',
      {
        messageId: newMessage?.id,
        channelId: oldMessage.channelId,
        avatar: (oldMessage.author as { avatar?: string | null })?.avatar ?? undefined,
      },
      {
        channelName: channel && 'name' in channel ? (channel as { name: string }).name : undefined,
        userTag: oldMessage.author?.tag ?? undefined,
        userId: oldMessage.author?.id ?? undefined,
        oldContent: oldMessage.content ?? undefined,
        newContent: newMessage.content ?? undefined,
        timestamp: new Date().toISOString(),
      },
    );
    publishDiscordEvent(this.redisService.getClient(), this.sharedConfig.redis.prefix, {
      guildId,
      discordGuildId,
      eventType: 'MESSAGE_UPDATE',
      data: {
        old: this.enrichMessageData(this.safeToJson(oldMessage), oldMessage),
        new: this.enrichMessageData(this.safeToJson(newMessage), newMessage),
      },
    });
  }

  async onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState, client: Client<true>): Promise<void> {
    const discordGuildId = oldState.guild.id;
    const guildId = await this.getGuildIdByDiscordId(discordGuildId);
    if (!guildId) return;

    const redis = this.redisService.getClient();
    const voiceKey = `${VOICE_COUNT_CACHE_PREFIX}${guildId}`;
    if (oldState.channelId) {
      await redis.decr(voiceKey).catch(() => {});
    }
    if (newState.channelId) {
      await redis.incr(voiceKey).catch(() => {});
    }
    const rawCount = await redis.get(voiceKey).catch(() => null);
    const voiceOnline = rawCount != null ? Math.max(0, parseInt(rawCount, 10)) : 0;
    this.logger.log(`[realtime] Discord → Redis guildId=${guildId} parameter=voiceOnline`);
    publishGuildStateEvent(this.redisService.getClient(), this.sharedConfig.redis.prefix, {
      guildId,
      discordGuildId,
      parameter: 'voiceOnline',
      direction: 'set',
      value: voiceOnline,
    });
    publishDiscordEvent(this.redisService.getClient(), this.sharedConfig.redis.prefix, {
      guildId,
      discordGuildId,
      eventType: 'VOICE_STATE_UPDATE',
      data: { old: this.safeToJson(oldState), new: this.safeToJson(newState) },
    });

    const voiceChannel = newState.channel ?? oldState.channel;
    const voiceMember = oldState.member ?? newState.member;
    await this.sendLogAndIngest(
      client,
      guildId,
      discordGuildId,
      'voice_change',
      {
        userId: voiceMember?.user?.id,
        avatar: (voiceMember?.user as { avatar?: string | null })?.avatar ?? undefined,
      },
      {
        userTag: voiceMember?.user?.tag ?? undefined,
        userId: voiceMember?.user?.id ?? undefined,
        voiceChannelName: voiceChannel?.name ?? undefined,
        timestamp: new Date().toISOString(),
      },
    );
  }

  async onGuildMemberUpdate(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember,
    client: Client<true>,
  ): Promise<void> {
    const discordGuildId = oldMember.guild.id;
    const guildId = await this.getGuildIdByDiscordId(discordGuildId);
    if (!guildId) return;

    const oldRoleIds = Array.from(oldMember.roles.cache?.keys() ?? []).filter((id) => id !== oldMember.guild.id);
    const newRoleIds = Array.from(newMember.roles.cache?.keys() ?? []).filter((id) => id !== newMember.guild.id);
    const prefix = this.sharedConfig.redis.prefix;
    const roleKey = `${prefix}${MEMBER_COUNT_CACHE_PREFIX}${guildId}${ROLE_COUNTS_CACHE_SUFFIX}`;
    const redis = this.redisService.getClient();
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
    const affectedRoleIds = [...new Set([...oldRoleIds.filter((id) => !newRoleIds.includes(id)), ...newRoleIds.filter((id) => !oldRoleIds.includes(id))])];
    if (affectedRoleIds.length > 0) {
      await this.countersQueueProducer.addCounterUpdatesForGuildRoles(guildId, affectedRoleIds);
    }

    const oldRoleNames = Array.from(oldMember.roles.cache?.values() ?? []).map((r) => r.name);
    const newRoleNames = Array.from(newMember.roles.cache?.values() ?? []).map((r) => r.name);
    const added = newRoleNames.filter((n) => !oldRoleNames.includes(n));
    const removed = oldRoleNames.filter((n) => !newRoleNames.includes(n));

    await this.sendLogAndIngest(
      client,
      guildId,
      discordGuildId,
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
    publishDiscordEvent(this.redisService.getClient(), this.sharedConfig.redis.prefix, {
      guildId,
      discordGuildId,
      eventType: 'GUILD_MEMBER_UPDATE',
      data: { old: this.safeToJson(oldMember), new: this.safeToJson(newMember) },
    });
  }

  async onThreadCreate(thread: ThreadChannel, _client: Client<true>): Promise<void> {
    const discordGuildId = thread.guildId ?? (thread.guild as { id: string } | null)?.id;
    if (!discordGuildId) return;
    const guildId = await this.getGuildIdByDiscordId(discordGuildId);
    if (!guildId) return;
    this.logger.log(`[realtime] Discord → Redis guildId=${guildId} parameter=threadCreated`);
    publishGuildStateEvent(this.redisService.getClient(), this.sharedConfig.redis.prefix, {
      guildId,
      discordGuildId,
      parameter: 'threadCreated',
      direction: 'set',
      value: {
        threadId: thread.id,
        channelId: thread.parentId ?? null,
        name: thread.name ?? null,
      },
    });
    publishDiscordEvent(this.redisService.getClient(), this.sharedConfig.redis.prefix, {
      guildId,
      discordGuildId,
      eventType: 'THREAD_CREATE',
      data: this.safeToJson(thread),
    });
  }

  async onThreadDelete(thread: ThreadChannel | { id: string; guildId?: string; guild?: { id: string } }, _client: Client<true>): Promise<void> {
    const discordGuildId = (thread as { guildId?: string }).guildId ?? (thread as { guild?: { id: string } }).guild?.id;
    if (!discordGuildId) return;
    const guildId = await this.getGuildIdByDiscordId(discordGuildId);
    if (!guildId) return;
    this.logger.log(`[realtime] Discord → Redis guildId=${guildId} parameter=threadCreated (dec)`);
    publishGuildStateEvent(this.redisService.getClient(), this.sharedConfig.redis.prefix, {
      guildId,
      discordGuildId,
      parameter: 'threadCreated',
      direction: 'dec',
      delta: 1,
    });
  }

  async onPresenceUpdate(oldPresence: Presence | null, newPresence: Presence, _client: Client<true>): Promise<void> {
    const discordGuildId = newPresence.guild?.id ?? oldPresence?.guild?.id;
    if (!discordGuildId) return;
    const guildId = await this.getGuildIdByDiscordId(discordGuildId);
    if (!guildId) return;

    const oldStatus = oldPresence?.status ?? null;
    const newStatus = newPresence?.status ?? null;
    const prefix = this.sharedConfig.redis.prefix;
    const key = `${prefix}${PRESENCE_CACHE_PREFIX}${guildId}`;
    const redis = this.redisService.getClient();
    if (isPresenceStatus(oldStatus)) {
      await redis.hincrby(key, oldStatus, -1).catch(() => {});
    }
    if (isPresenceStatus(newStatus)) {
      await redis.hincrby(key, newStatus, 1).catch(() => {});
    }

    const presenceHash = (await redis.hgetall(key).catch(() => ({}))) as Record<string, string>;
    const onlineMembers = PRESENCE_STATUSES.slice(0, -1).reduce(
      (sum, status) => sum + Math.max(0, parseInt(presenceHash[status] ?? '0', 10)),
      0,
    );
    const lastKey = `${prefix}${ONLINE_MEMBERS_LAST_PREFIX}${guildId}`;
    const lastRaw = await redis.get(lastKey).catch(() => null);
    const lastValue = lastRaw != null ? parseInt(lastRaw, 10) : null;
    if (lastValue !== onlineMembers) {
      await redis.set(lastKey, String(onlineMembers)).catch(() => {});
      publishGuildStateEvent(this.redisService.getClient(), prefix, {
        guildId,
        discordGuildId,
        parameter: 'onlineMembers',
        direction: 'set',
        value: onlineMembers,
      });
    }

    await this.countersQueueProducer.addCounterUpdatesForGuildPresence(guildId);
    publishDiscordEvent(this.redisService.getClient(), this.sharedConfig.redis.prefix, {
      guildId,
      discordGuildId,
      eventType: 'PRESENCE_UPDATE',
      data: { old: this.safeToJson(oldPresence), new: this.safeToJson(newPresence) },
    });
  }

  private async getGuildIdByDiscordId(discordGuildId: string): Promise<string | null> {
    const guild = await this.guildRepository.findOne({ where: { discordGuildId }, select: ['id'] });
    return guild?.id ?? null;
  }
}
