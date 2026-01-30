/**
 * Entry для ShardingManager: запускается в дочернем процессе.
 * Читает shard id из process.argv, подключается к БД и Redis, создаёт Client и обрабатывает READY/GUILD_CREATE/GUILD_DELETE и interactionCreate.
 */
import 'reflect-metadata';
import { Client, GatewayIntentBits } from 'discord.js';
import Redis from 'ioredis';
import { AppDataSource, Guild } from '@app/shared';
import {
  syncOnGuildCreate,
  syncOnGuildDelete,
} from '../guild-sync/guild-sync.updates';
import { createInteractionHandler } from './interaction-handler';

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
    intents: [GatewayIntentBits.Guilds],
    shards: [SHARD_ID],
    shardCount: SHARD_COUNT,
  });

  const prefix = `sn:${envPrefix()}:`;
  const redisHost = process.env['REDIS_HOST'] ?? 'localhost';
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
    try {
      await syncOnGuildCreate(AppDataSource.manager, {
        discordGuildId: guild.id,
        guildName: guild.name,
        shardId: SHARD_ID,
      });
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

  await client.login(token);
}

run().catch((err) => {
  console.error('[shard-worker] fatal:', err);
  process.exit(1);
});
