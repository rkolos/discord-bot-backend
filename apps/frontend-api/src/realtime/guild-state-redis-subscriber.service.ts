import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { SharedConfigService, GUILD_STATE_CHANNEL_SUFFIX, DISCORD_EVENTS_CHANNEL_SUFFIX } from '@app/shared';
import type { GuildStateEventPayload, DiscordEventPayload } from '@app/shared';
import { GuildStateGateway } from './guild-state.gateway';

@Injectable()
export class GuildStateRedisSubscriberService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(GuildStateRedisSubscriberService.name);
  private subscriber: Redis | null = null;
  private started = false;

  constructor(
    private readonly sharedConfig: SharedConfigService,
    private readonly gateway: GuildStateGateway,
  ) {
    this.logger.log('[realtime] GuildStateRedisSubscriberService constructed');
  }

  /** Called from onModuleInit and from RealtimeBootstrapService so subscription runs even if Nest defers subscriber init. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.logger.log(`[realtime-init] subscriber start() called cwd=${process.cwd()}`);
    const { host, port, password, prefix } = this.sharedConfig.redis;
    const guildStateChannel = prefix + GUILD_STATE_CHANNEL_SUFFIX;
    const discordEventsChannel = prefix + DISCORD_EVENTS_CHANNEL_SUFFIX;
    this.logger.log(`[realtime-init] subscribing to channels=${guildStateChannel}, ${discordEventsChannel} redis=${host}:${port ?? 6379}`);
    this.subscriber = new Redis({
      host: host || 'localhost',
      port: port ?? 6379,
      password: password ?? undefined,
    });
    this.logger.log(`Subscribing to Redis channels: ${guildStateChannel}, ${discordEventsChannel}`);
    this.subscriber.subscribe(guildStateChannel, (err) => {
      if (err) {
        this.logger.error(`[realtime-init] Redis subscribe failed (guild-state): ${err.message}`);
        return;
      }
      this.logger.log(`[realtime-init] Subscribed to Redis channel ${guildStateChannel}`);
    });
    this.subscriber.subscribe(discordEventsChannel, (err) => {
      if (err) {
        this.logger.error(`[realtime-init] Redis subscribe failed (discord-events): ${err.message}`);
        return;
      }
      this.logger.log(`[realtime-init] Subscribed to Redis channel ${discordEventsChannel}`);
    });
    this.subscriber.on('message', (ch: string, message: string) => {
      try {
        if (ch === discordEventsChannel) {
          const payload = JSON.parse(message) as DiscordEventPayload;
          if (
            typeof payload.guildId !== 'string' ||
            !payload.guildId ||
            typeof payload.eventType !== 'string' ||
            !payload.eventType
          ) {
            return;
          }
          this.gateway.broadcastDiscordEventToGuild(payload.guildId, payload);
          return;
        }
        const payload = JSON.parse(message) as GuildStateEventPayload;
        if (
          typeof payload.guildId !== 'string' ||
          !payload.guildId ||
          typeof payload.discordGuildId !== 'string' ||
          !payload.discordGuildId ||
          typeof payload.parameter !== 'string' ||
          !payload.parameter
        ) {
          return;
        }
        this.gateway.broadcastToGuild(payload.guildId, payload);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        this.logger.error(
          `Failed to process Redis message in channel ${ch}: ${err.message}`,
          err.stack,
        );
      }
    });
  }

  onApplicationBootstrap(): void {
    this.start();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
  }
}
