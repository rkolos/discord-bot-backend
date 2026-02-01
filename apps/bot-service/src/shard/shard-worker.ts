/**
 * Entry для ShardingManager: запускается в дочернем процессе.
 * Читает shard id из process.argv, подключается к БД и Redis, создаёт Client и обрабатывает READY/GUILD_CREATE/GUILD_DELETE, interactionCreate, логи и счётчики.
 */
import 'reflect-metadata';
import { Client, GatewayIntentBits } from 'discord.js';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { AppDataSource, Guild, GUILD_SETUP_QUEUE_NAME } from '@app/shared';
import type { GuildSetupJobPayload } from '@app/shared';
import {
  syncOnGuildCreate,
  syncOnGuildDelete,
} from '../guild-sync/guild-sync.updates';
import { createInteractionHandler } from './interaction-handler';
import { createShardEventHandlers } from './shard-event-handlers';

const SHARD_ID = parseInt(process.argv[2] ?? '0', 10);
const SHARD_COUNT = parseInt(process.argv[3] ?? '1', 10);
const HEARTBEAT_TTL_SEC = 60;
const HEARTBEAT_INTERVAL_MS = 30_000;

function envPrefix(): string {
  const nodeEnv = process.env['NODE_ENV'] ?? 'development';
  const map: Record<string, string> = {
    development: 'dev',
    production: 'prod',
    stage: 'stage',
    test: 'test',
  };
  return map[nodeEnv] ?? 'dev';
}

function createRedisClient(): Redis {
  const host = process.env['REDIS_HOST'] ?? 'localhost';
  const port = parseInt(process.env['REDIS_PORT'] ?? '6379', 10);
  const password = process.env['REDIS_PASSWORD'] ?? undefined;
  return new Redis({ host, port, password });
}

function internalBaseUrl(): string {
  const base = process.env['BOT_SERVICE_INTERNAL_BASE_URL'];
  if (base && typeof base === 'string') return base.replace(/\/$/, '');
  const port = process.env['PORT'] ?? process.env['HEALTH_PORT'] ?? '3003';
  return `http://127.0.0.1:${port}`;
}

async function run(): Promise<void> {
  const token = process.env['DISCORD_BOT_TOKEN'];
  if (!token || typeof token !== 'string') {
    console.error('[shard-worker] DISCORD_BOT_TOKEN is required');
    process.exit(1);
  }

  await AppDataSource.initialize();

  const redis = createRedisClient();
  const shardKey = `sn:${envPrefix()}:bot-service:shard:${SHARD_ID}`;

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildVoiceStates,
    ],
    shards: [SHARD_ID],
    shardCount: SHARD_COUNT,
  });

  const prefix = `sn:${envPrefix()}:`;
  const redisHost = process.env['REDIS_HOST'] ?? 'localhost';

  const guildSetupQueue = new Queue<GuildSetupJobPayload>(GUILD_SETUP_QUEUE_NAME, {
    connection: {
      host: redisHost,
      port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
      password: process.env['REDIS_PASSWORD'] ?? undefined,
    },
    prefix,
  });
  const redisPort = parseInt(process.env['REDIS_PORT'] ?? '6379', 10);
  const redisPassword = process.env['REDIS_PASSWORD'] ?? undefined;

  async function getGuildId(discordGuildId: string): Promise<string | null> {
    const guild = await AppDataSource.getRepository(Guild).findOne({
      where: { discordGuildId },
      select: ['id'],
    });
    return guild?.id ?? null;
  }

  const interactionHandler = createInteractionHandler({
    redisHost,
    redisPort,
    redisPassword,
    redisPrefix: prefix,
    internalBaseUrl: internalBaseUrl(),
    getGuildId,
  });

  const eventHandlers = createShardEventHandlers({
    redis,
    redisPrefix: prefix,
    redisHost,
    redisPort,
    redisPassword,
    getGuildId,
    fetchChannel: async (channelId: string) => {
      const ch = await client.channels.fetch(channelId);
      if (!ch || !('send' in ch)) return null;
      return ch as unknown as { send: (opts: { embeds: unknown[] }) => Promise<unknown> };
    },
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    try {
      await interactionHandler.handle(interaction, client as import('discord.js').Client<true>);
    } catch (err) {
      console.error(`[shard-worker] interactionCreate error: ${(err as Error).message}`);
    }
  });

  async function writeHeartbeat(): Promise<void> {
    try {
      const guildCount = client.guilds?.cache?.size ?? 0;
      const ping = client.ws?.ping ?? 0;
      await redis.hset(shardKey, 'status', 'READY', 'timestamp', String(Date.now()), 'guildCount', String(guildCount), 'ping', String(ping));
      await redis.expire(shardKey, HEARTBEAT_TTL_SEC);
    } catch (err) {
      console.error(`[shard-worker] heartbeat error: ${(err as Error).message}`);
    }
  }

  client.once('ready', () => {
    console.log(`[shard-worker] Shard ${SHARD_ID} READY`);
    void writeHeartbeat();
    setInterval(() => void writeHeartbeat(), HEARTBEAT_INTERVAL_MS);
  });

  client.on('guildCreate', async (guild) => {
    console.log(`[shard-worker] GUILD_CREATE received from Discord: discordGuildId=${guild.id} name=${guild.name}`);
    try {
      const result = await syncOnGuildCreate(AppDataSource.manager, {
        discordGuildId: guild.id,
        guildName: guild.name,
        shardId: SHARD_ID,
        discordOwnerId: guild.ownerId,
      });
      if (result) {
        if ('syncedGuildId' in result) {
          const url = `${internalBaseUrl()}/internal/guilds/${result.syncedGuildId}/sync`;
          const secret = process.env['INTERNAL_API_SECRET'];
          await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(secret && { 'X-Internal-Secret': secret }),
            },
          }).catch((e) => {
            console.error(`[shard-worker] guild sync HTTP error: ${(e as Error).message}`);
          });
        } else {
          await guildSetupQueue.add('setup', result, { priority: 5 }).catch((e) => {
            console.error(`[shard-worker] guildSetupQueue.add error: ${(e as Error).message}`);
          });
        }
      }
    } catch (err) {
      console.error(`[shard-worker] guildCreate sync error: ${(err as Error).message}`);
    }
  });

  client.on('guildDelete', async (guild) => {
    try {
      await syncOnGuildDelete(AppDataSource.manager, {
        discordGuildId: guild.id,
      });
    } catch (err) {
      console.error(`[shard-worker] guildDelete sync error: ${(err as Error).message}`);
    }
  });

  client.on('guildMemberAdd', async (member) => {
    try {
      await eventHandlers.onGuildMemberAdd(member);
    } catch (err) {
      console.error(`[shard-worker] guildMemberAdd error: ${(err as Error).message}`);
    }
  });

  client.on('guildMemberRemove', async (member) => {
    try {
      await eventHandlers.onGuildMemberRemove(member);
    } catch (err) {
      console.error(`[shard-worker] guildMemberRemove error: ${(err as Error).message}`);
    }
  });

  client.on('messageDelete', async (message) => {
    try {
      await eventHandlers.onMessageDelete(message as Parameters<typeof eventHandlers.onMessageDelete>[0]);
    } catch (err) {
      console.error(`[shard-worker] messageDelete error: ${(err as Error).message}`);
    }
  });

  client.on('messageUpdate', async (oldMessage, newMessage) => {
    try {
      await eventHandlers.onMessageUpdate(
        oldMessage as Parameters<typeof eventHandlers.onMessageUpdate>[0],
        newMessage as Parameters<typeof eventHandlers.onMessageUpdate>[1],
      );
    } catch (err) {
      console.error(`[shard-worker] messageUpdate error: ${(err as Error).message}`);
    }
  });

  client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
      await eventHandlers.onVoiceStateUpdate(
        oldState as Parameters<typeof eventHandlers.onVoiceStateUpdate>[0],
        newState as Parameters<typeof eventHandlers.onVoiceStateUpdate>[1],
      );
    } catch (err) {
      console.error(`[shard-worker] voiceStateUpdate error: ${(err as Error).message}`);
    }
  });

  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
      await eventHandlers.onGuildMemberUpdate(
        oldMember as Parameters<typeof eventHandlers.onGuildMemberUpdate>[0],
        newMember as Parameters<typeof eventHandlers.onGuildMemberUpdate>[1],
      );
    } catch (err) {
      console.error(`[shard-worker] guildMemberUpdate error: ${(err as Error).message}`);
    }
  });

  await client.login(token);
}

run().catch((err) => {
  console.error('[shard-worker] fatal:', err);
  process.exit(1);
});
