import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmbedBuilder } from 'discord.js';
import { randomUUID } from 'crypto';
import type { Client, GuildMember, Message, PartialMessage, VoiceState, PartialGuildMember } from 'discord.js';
import { Guild, GuildLogSetting, buildLogEmbedData, RedisService, SharedConfigService } from '@app/shared';
import { RawEventsQueueService } from '../raw-events/raw-events-queue.service';
import { CountersQueueProducerService } from '../counters-queue-producer/counters-queue-producer.service';
import type { RawEventJobPayload } from '../raw-events/raw-events-queue.types';

const MEMBER_COUNT_CACHE_PREFIX = 'bot-service:cache:guild:';
const MEMBER_COUNT_SUFFIX = ':member_count';
const LOG_SETTINGS_CACHE_PREFIX = 'bot-service:cache:log-settings:';

@Injectable()
export class MultiTokenEventsService {
  constructor(
    @InjectRepository(Guild)
    private readonly guildRepository: Repository<Guild>,
    @InjectRepository(GuildLogSetting)
    private readonly logSettingsRepository: Repository<GuildLogSetting>,
    private readonly sharedConfig: SharedConfigService,
    private readonly redisService: RedisService,
    private readonly rawEventsQueue: RawEventsQueueService,
    private readonly countersQueueProducer: CountersQueueProducerService,
  ) {}

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

    await this.sendLogAndIngest(
      client,
      guildId,
      discordGuildId,
      'member_join',
      { userId: member.user?.id, userTag: member.user?.tag },
      {
        userTag: member.user?.tag ?? undefined,
        userId: member.user?.id ?? undefined,
        timestamp: new Date().toISOString(),
      },
    );
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

    const user = member.user;
    await this.sendLogAndIngest(
      client,
      guildId,
      discordGuildId,
      'member_leave',
      { userId: user?.id, userTag: user?.tag },
      {
        userTag: user?.tag ?? undefined,
        userId: user?.id ?? undefined,
        timestamp: new Date().toISOString(),
      },
    );
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
      { messageId: message.id, channelId: message.channelId, userId: message.author?.id },
      {
        channelName: channel && 'name' in channel ? (channel as { name: string }).name : undefined,
        userTag: message.author?.tag ?? undefined,
        userId: message.author?.id ?? undefined,
        messageContent: message.content ?? undefined,
        timestamp: new Date().toISOString(),
      },
    );
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
      { messageId: newMessage?.id, channelId: oldMessage.channelId },
      {
        channelName: channel && 'name' in channel ? (channel as { name: string }).name : undefined,
        userTag: oldMessage.author?.tag ?? undefined,
        userId: oldMessage.author?.id ?? undefined,
        oldContent: oldMessage.content ?? undefined,
        newContent: newMessage.content ?? undefined,
        timestamp: new Date().toISOString(),
      },
    );
  }

  async onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState, client: Client<true>): Promise<void> {
    const discordGuildId = oldState.guild.id;
    const guildId = await this.getGuildIdByDiscordId(discordGuildId);
    if (!guildId) return;

    const voiceChannel = newState.channel ?? oldState.channel;
    await this.sendLogAndIngest(
      client,
      guildId,
      discordGuildId,
      'voice_change',
      { userId: oldState.member?.user?.id },
      {
        userTag: oldState.member?.user?.tag ?? undefined,
        userId: oldState.member?.user?.id ?? undefined,
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
  }

  private async getGuildIdByDiscordId(discordGuildId: string): Promise<string | null> {
    const guild = await this.guildRepository.findOne({ where: { discordGuildId }, select: ['id'] });
    return guild?.id ?? null;
  }
}
