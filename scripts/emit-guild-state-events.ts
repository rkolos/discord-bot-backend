/**
 * Симуляция событий guild-state: публикует в Redis по одному тестовому событию
 * для каждого параметра GuildStateParameter. Frontend-api, подписанный на канал,
 * получит их и запишет в .cursor/debug.log (kind: received; при подписанном сокете — kind: sent).
 *
 * Запуск:
 *   GUILD_ID=<uuid-гильдии> DISCORD_GUILD_ID=<snowflake> npm run emit-guild-state-events
 *
 * Требования:
 *   - frontend-api должен быть запущен (подписан на Redis и пишет в .cursor/debug.log).
 *   - GUILD_ID и DISCORD_GUILD_ID — реальная гильдия из БД (для записей sent подписаться
 *     через auth-and-socket с SUBSCRIBE_GUILD_IDS).
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import Redis from 'ioredis';
import { GUILD_STATE_CHANNEL_SUFFIX } from '@app/shared';
import type { GuildStateEventPayload } from '@app/shared';

config({ path: resolve(process.cwd(), '.env') });

function redisPrefix(): string {
  const nodeEnv = process.env['NODE_ENV'] ?? 'development';
  const map: Record<string, string> = {
    development: 'dev',
    production: 'prod',
    stage: 'stage',
    test: 'test',
  };
  const envShort = map[nodeEnv] ?? 'dev';
  return `sn:${envShort}:`;
}

function buildPayload(
  guildId: string,
  discordGuildId: string,
  parameter: GuildStateEventPayload['parameter'],
  direction: GuildStateEventPayload['direction'],
  value?: GuildStateEventPayload['value'],
  delta?: number,
): GuildStateEventPayload {
  const payload: GuildStateEventPayload = {
    guildId,
    discordGuildId,
    parameter,
    direction,
    timestamp: new Date().toISOString(),
  };
  if (value !== undefined) payload.value = value;
  if (delta !== undefined) payload.delta = delta;
  return payload;
}

async function main(): Promise<void> {
  const guildId = process.env['GUILD_ID'];
  const discordGuildId = process.env['DISCORD_GUILD_ID'];
  if (!guildId || !discordGuildId) {
    console.error('Set GUILD_ID and DISCORD_GUILD_ID (e.g. from your DB or /api/me/guilds).');
    process.exit(1);
  }

  const host = process.env['REDIS_HOST'] ?? 'localhost';
  const port = parseInt(process.env['REDIS_PORT'] ?? '6379', 10);
  const password = process.env['REDIS_PASSWORD'] ?? undefined;
  const prefix = redisPrefix();
  const channel = prefix + GUILD_STATE_CHANNEL_SUFFIX;

  console.log(`[emit-guild-state-events] Redis ${host}:${port} channel=${channel}`);
  console.log(`[emit-guild-state-events] guildId=${guildId} discordGuildId=${discordGuildId}`);

  const redis = new Redis({ host, port, password });

  const payloads: GuildStateEventPayload[] = [
    buildPayload(guildId, discordGuildId, 'historySyncStatus', 'set', 'PROCESSING'),
    buildPayload(guildId, discordGuildId, 'historySyncStatus', 'set', 'COMPLETED'),
    buildPayload(guildId, discordGuildId, 'historySyncStatus', 'set', 'FAILED'),
    buildPayload(guildId, discordGuildId, 'memberCount', 'set', 100),
    buildPayload(guildId, discordGuildId, 'onlineMembers', 'set', 50),
    buildPayload(guildId, discordGuildId, 'totalMessages', 'set', 1000),
    buildPayload(guildId, discordGuildId, 'threadCreated', 'set', {
      threadId: '1392600000000000001',
      channelId: '1392500000000000001',
      name: 'Test thread',
    }),
    buildPayload(guildId, discordGuildId, 'threadCreated', 'dec', undefined, 1),
    buildPayload(guildId, discordGuildId, 'lastActivity', 'set', new Date().toISOString()),
    buildPayload(guildId, discordGuildId, 'bot_status', 'set', 'installed'),
    buildPayload(guildId, discordGuildId, 'bot_status', 'set', 'not_installed'),
    buildPayload(guildId, discordGuildId, 'isBotInGuild', 'set', true),
    buildPayload(guildId, discordGuildId, 'isBotInGuild', 'set', false),
    buildPayload(guildId, discordGuildId, 'guildInfo', 'set', {
      name: 'Test Guild',
      iconUrl: 'https://cdn.discordapp.com/icons/123/abc.png',
      banner: null,
    }),
    buildPayload(guildId, discordGuildId, 'botConnected', 'set', true),
    buildPayload(guildId, discordGuildId, 'botConnected', 'set', false),
    buildPayload(guildId, discordGuildId, 'lastSyncAt', 'set', new Date().toISOString()),
    buildPayload(guildId, discordGuildId, 'voiceOnline', 'set', 5),
  ];

  const paramsSent = [...new Set(payloads.map((p) => p.parameter))];
  for (const p of payloads) {
    await redis.publish(channel, JSON.stringify(p));
  }
  await redis.quit();

  console.log(`[emit-guild-state-events] Published ${payloads.length} event(s): ${paramsSent.join(', ')}`);
  console.log('[emit-guild-state-events] Check .cursor/debug.log (frontend-api must be running).');
}

main().catch((err) => {
  console.error('[emit-guild-state-events] Fatal:', err);
  process.exit(1);
});
