/**
 * Seed скрипт для генерации тестовых данных в PostgreSQL и ClickHouse.
 * Запуск: npm run seed [-- --clean]
 * Требует .env: POSTGRES_*, CLICKHOUSE_*, REDIS_*, ENCRYPTION_KEY_V1
 */
import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'path';
import { writeFileSync } from 'node:fs';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { createClient, type ClickHouseClient } from '@clickhouse/client';
import Redis from 'ioredis';
import { AppDataSource } from '../libs/shared/src/database/data-source';
import {
  AdminUser,
  AdminUserRole,
  User,
  UserPlan,
  UserStatus,
  Company,
  CompanyMember,
  CompanyMemberRole,
  Guild,
  GuildStatus,
  GuildSubscriptionTier,
  ServerSettings,
  GuildModule,
  GuildLogSetting,
  Counter,
  CounterType,
  CounterMetric,
  CounterStatus,
  encryptToken,
  getRetentionDaysForTier,
} from '../libs/shared/src';

config({ path: resolve(process.cwd(), '.env') });

const SALT_ROUNDS = 10;

const HOURLY_WEIGHTS: number[] = Array.from({ length: 24 }, (_, h) => {
  if (h >= 2 && h <= 7) return 0.05;
  if (h >= 9 && h <= 17) return h === 12 || h === 13 ? 0.6 : 0.4;
  if (h >= 19 && h <= 23) return 0.9 + (h - 19) * 0.025;
  return 0.2;
});

function weightedRandomHour(): number {
  const sum = HOURLY_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let h = 0; h < 24; h++) {
    r -= HOURLY_WEIGHTS[h];
    if (r <= 0) return h;
  }
  return 23;
}

function snowflake(): string {
  return faker.string.numeric(18);
}

function toClickHouseDateTime(iso: string): string {
  return iso.replace('T', ' ').replace('Z', '').slice(0, 19);
}

function computeRetentionUntil(eventTime: Date | string, planTier: string): Date {
  const t = typeof eventTime === 'string' ? new Date(eventTime) : eventTime;
  const days = getRetentionDaysForTier(planTier);
  const out = new Date(t);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

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

async function runClickHouseMigrations(ch: ClickHouseClient): Promise<void> {
  const db = process.env['CLICKHOUSE_DB'] ?? 'default';
  const tableRawEvents = `${db}.raw_events`;

  await ch.command({
    query: `
      CREATE TABLE IF NOT EXISTS ${tableRawEvents}
      (
        event_id UUID,
        event_time DateTime,
        event_date Date DEFAULT toDate(event_time),
        event_type LowCardinality(String) DEFAULT '',
        guild_id UUID,
        discord_guild_id String DEFAULT '',
        user_id Nullable(UUID),
        discord_user_id String DEFAULT '',
        anonymized_hash Nullable(String),
        channel_id String DEFAULT '',
        role_id String DEFAULT '',
        command_name String DEFAULT '',
        plan_tier LowCardinality(String) DEFAULT '',
        is_bot_generated UInt8 DEFAULT 0,
        payload String DEFAULT '',
        ingested_at DateTime,
        retention_until DateTime,
        is_historical UInt8 DEFAULT 0
      )
      ENGINE = MergeTree
      PARTITION BY toStartOfWeek(event_time)
      ORDER BY (guild_id, event_date, event_type, user_id)
      TTL retention_until
      SETTINGS allow_nullable_key = 1
    `,
    clickhouse_settings: { wait_end_of_query: 1 },
  });
  console.log('ClickHouse raw_events table ready');

  const mvs = [
    `CREATE MATERIALIZED VIEW IF NOT EXISTS ${db}.mv_daily_activity ENGINE = AggregatingMergeTree PARTITION BY toStartOfWeek(event_date) ORDER BY (guild_id, event_date) AS SELECT guild_id, event_date, countIfState(event_type = 'MESSAGE_CREATE') AS messages_count, countIfState(event_type = 'GUILD_MEMBER_ADD') AS members_joined, sumState(if(event_type = 'VOICE_STATE_UPDATE', toUInt64(JSONExtractInt(payload, 'voiceMinutes')), 0)) AS voice_minutes, uniqCombinedState(user_id) AS unique_users_count FROM ${tableRawEvents} GROUP BY guild_id, event_date`,
    `CREATE MATERIALIZED VIEW IF NOT EXISTS ${db}.mv_heatmap ENGINE = SummingMergeTree PARTITION BY toStartOfWeek(event_date) ORDER BY (guild_id, day_of_week, hour) AS SELECT guild_id, toDayOfWeek(event_time) AS day_of_week, toHour(event_time) AS hour, event_date, count() AS events_count FROM ${tableRawEvents} WHERE event_type = 'MESSAGE_CREATE' GROUP BY guild_id, day_of_week, hour, event_date`,
    `CREATE MATERIALIZED VIEW IF NOT EXISTS ${db}.mv_role_stats ENGINE = SummingMergeTree PARTITION BY toStartOfWeek(event_date) ORDER BY (guild_id, role_id, event_date) AS SELECT guild_id, role_id, event_date, count() AS events_count FROM ${tableRawEvents} WHERE role_id != '' GROUP BY guild_id, role_id, event_date`,
    `CREATE MATERIALIZED VIEW IF NOT EXISTS ${db}.mv_command_stats ENGINE = SummingMergeTree PARTITION BY toStartOfWeek(event_date) ORDER BY (guild_id, command_name, event_date) AS SELECT guild_id, command_name, event_date, count() AS execution_count, sumIf(1, JSONExtractBool(payload, 'isError') = 1) AS error_count FROM ${tableRawEvents} WHERE command_name != '' GROUP BY guild_id, command_name, event_date`,
    `CREATE MATERIALIZED VIEW IF NOT EXISTS ${db}.mv_voice_stats ENGINE = SummingMergeTree PARTITION BY toStartOfWeek(event_date) ORDER BY (guild_id, user_id, event_date) SETTINGS allow_nullable_key = 1 AS SELECT guild_id, user_id, event_date, sum(toUInt64(JSONExtractInt(payload, 'voiceMinutes'))) AS voice_minutes FROM ${tableRawEvents} WHERE event_type = 'VOICE_STATE_UPDATE' GROUP BY guild_id, user_id, event_date`,
    `CREATE MATERIALIZED VIEW IF NOT EXISTS ${db}.mv_top_members ENGINE = SummingMergeTree PARTITION BY toStartOfWeek(event_date) ORDER BY (guild_id, user_id) SETTINGS allow_nullable_key = 1 AS SELECT guild_id, user_id, event_date, sumIf(1, event_type = 'MESSAGE_CREATE') AS message_count, sumIf(toUInt64(JSONExtractInt(payload, 'voiceMinutes')), event_type = 'VOICE_STATE_UPDATE') AS voice_minutes FROM ${tableRawEvents} WHERE is_bot_generated = 0 GROUP BY guild_id, user_id, event_date`,
    `CREATE MATERIALIZED VIEW IF NOT EXISTS ${db}.mv_top_channels_messages ENGINE = SummingMergeTree PARTITION BY toStartOfWeek(event_date) ORDER BY (guild_id, channel_id, event_date) AS SELECT guild_id, channel_id, event_date, count() AS messages_count FROM ${tableRawEvents} WHERE event_type = 'MESSAGE_CREATE' AND channel_id != '' GROUP BY guild_id, channel_id, event_date`,
    `CREATE MATERIALIZED VIEW IF NOT EXISTS ${db}.mv_top_channels_voice ENGINE = SummingMergeTree PARTITION BY toStartOfWeek(event_date) ORDER BY (guild_id, channel_id, event_date) AS SELECT guild_id, channel_id, event_date, sum(toUInt64(JSONExtractInt(payload, 'voiceMinutes'))) AS voice_minutes FROM ${tableRawEvents} WHERE event_type = 'VOICE_STATE_UPDATE' AND channel_id != '' GROUP BY guild_id, channel_id, event_date`,
  ];
  for (const q of mvs) {
    await ch.command({ query: q, clickhouse_settings: { wait_end_of_query: 1 } });
  }
}

async function runCleanup(ds: typeof AppDataSource, ch: ClickHouseClient, redis: Redis): Promise<void> {
  console.log('Cleaning up...');
  const db = process.env['CLICKHOUSE_DB'] ?? 'default';
  await ch.command({
    query: `TRUNCATE TABLE ${db}.raw_events`,
    clickhouse_settings: { wait_end_of_query: 1 },
  });
  console.log('ClickHouse raw_events truncated');

  await ds.query('TRUNCATE users, admin_users RESTART IDENTITY CASCADE');
  console.log('PostgreSQL truncated');
}

interface SeedResult {
  users: User[];
  companies: Company[];
  guilds: Guild[];
  counters: Counter[];
  rawEventsCount: number;
}

interface SeedOutput {
  frontendUser: { email: string; password: string };
  adminUser: { email: string; password: string };
  guilds: Array<{ discordGuildId: string; id: string }>;
  companyId: string;
  counters: Array<{ id: string; guildDiscordId: string }>;
}

async function seedPostgres(ds: typeof AppDataSource, encryptionKey: string): Promise<SeedResult> {
  const adminRepo = ds.getRepository(AdminUser);
  const userRepo = ds.getRepository(User);
  const companyRepo = ds.getRepository(Company);
  const memberRepo = ds.getRepository(CompanyMember);
  const guildRepo = ds.getRepository(Guild);
  const settingsRepo = ds.getRepository(ServerSettings);
  const moduleRepo = ds.getRepository(GuildModule);
  const logRepo = ds.getRepository(GuildLogSetting);
  const counterRepo = ds.getRepository(Counter);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const admin1 = adminRepo.create({
    email: 'admin@server-ninja.local',
    name: 'Super Admin',
    role: AdminUserRole.SUPER_ADMIN,
    passwordHash: await bcrypt.hash('Admin123!', SALT_ROUNDS),
  });
  const admin2 = adminRepo.create({
    email: 'moderator@server-ninja.local',
    name: 'Moderator',
    role: AdminUserRole.ADMIN,
    passwordHash: await bcrypt.hash('Mod123!', SALT_ROUNDS),
  });
  await adminRepo.save([admin1, admin2]);
  console.log('Admin users created');

  const smokeUser = userRepo.create({
    username: 'smoke-user',
    discriminator: null,
    avatarUrl: null,
    email: 'smoke@server-ninja.local',
    passwordHash: await bcrypt.hash('SmokeTest1!', SALT_ROUNDS),
    plan: UserPlan.FREE,
    status: UserStatus.ACTIVE,
    discordId: snowflake(),
    createdAt: faker.date.between({ from: thirtyDaysAgo, to: now }),
  });
  await userRepo.save(smokeUser);

  const users: User[] = [smokeUser];
  for (let i = 0; i < 9; i++) {
    const createdAt = faker.date.between({ from: thirtyDaysAgo, to: now });
    const user = userRepo.create({
      username: faker.internet.username(),
      discriminator: null,
      avatarUrl: null,
      email: faker.internet.email().toLowerCase(),
      passwordHash: null,
      plan: i < 1 ? UserPlan.PRO : UserPlan.FREE,
      status: UserStatus.ACTIVE,
      discordId: i < 2 ? snowflake() : null,
      createdAt,
    });
    await userRepo.save(user);
    users.push(user);
  }
  console.log(`${users.length} users created (incl. smoke-user)`);

  const companies: Company[] = [];
  const company1 = companyRepo.create({
    name: faker.company.name(),
    ownerId: smokeUser.id,
  });
  await companyRepo.save(company1);
  companies.push(company1);

  const company2 = companyRepo.create({
    name: faker.company.name(),
    ownerId: users[5].id,
  });
  await companyRepo.save(company2);
  companies.push(company2);

  await memberRepo.save([
    memberRepo.create({ companyId: company1.id, userId: smokeUser.id, role: CompanyMemberRole.OWNER, joinedAt: now }),
    memberRepo.create({ companyId: company1.id, userId: users[1].id, role: CompanyMemberRole.ADMIN, joinedAt: now }),
    memberRepo.create({ companyId: company1.id, userId: users[2].id, role: CompanyMemberRole.MEMBER, joinedAt: now }),
    memberRepo.create({ companyId: company1.id, userId: users[3].id, role: CompanyMemberRole.MEMBER, joinedAt: now }),
    memberRepo.create({ companyId: company1.id, userId: users[4].id, role: CompanyMemberRole.MEMBER, joinedAt: now }),
    memberRepo.create({ companyId: company2.id, userId: users[5].id, role: CompanyMemberRole.OWNER, joinedAt: now }),
    memberRepo.create({ companyId: company2.id, userId: users[6].id, role: CompanyMemberRole.ADMIN, joinedAt: now }),
    memberRepo.create({ companyId: company2.id, userId: users[7].id, role: CompanyMemberRole.MEMBER, joinedAt: now }),
    memberRepo.create({ companyId: company2.id, userId: users[8].id, role: CompanyMemberRole.MEMBER, joinedAt: now }),
    memberRepo.create({ companyId: company2.id, userId: users[9].id, role: CompanyMemberRole.MEMBER, joinedAt: now }),
  ]);
  console.log('Companies and members created');

  const guilds: Guild[] = [];
  const firstGuildCounters: Counter[] = [];
  const fakeToken = `MTk${faker.string.alphanumeric(68)}.${faker.string.alphanumeric(6)}.${faker.string.alphanumeric(27)}`;
  const encryptedToken = encryptToken(fakeToken, encryptionKey);

  for (let i = 0; i < 5; i++) {
    const isPremium = i === 0;
    const hasBot = i < 2;
    const guild = guildRepo.create({
      discordGuildId: snowflake(),
      name: faker.company.name() + ' Server',
      iconUrl: null,
      banner: null,
      ownerId: i === 0 ? smokeUser.id : users[i].id,
      status: GuildStatus.ACTIVE,
      subscriptionTier: isPremium ? GuildSubscriptionTier.PRO : GuildSubscriptionTier.FREE,
      memberCount: faker.number.int({ min: 10, max: 500 }),
      messageCount: '0',
      onlineMembers: null,
      memberGrowth: null,
      lastActivity: null,
      shardId: hasBot ? (i % 2) : null,
      isBotInGuild: hasBot,
      createdAt: faker.date.between({ from: thirtyDaysAgo, to: now }),
    });
    await guildRepo.save(guild);
    guilds.push(guild);

    await settingsRepo.save(
      settingsRepo.create({
        guildId: guild.id,
        serverName: guild.name,
        serverDescription: faker.lorem.sentence(),
        language: 'en',
        timezone: 'UTC',
        botTokenEncrypted: hasBot ? encryptedToken : null,
        botConnected: hasBot,
        botUserId: hasBot ? snowflake() : null,
        lastConnected: hasBot ? now : null,
        lastSyncAt: null,
        dataRetentionDays: isPremium ? 365 : 30,
        anonymizeUserData: false,
        shareAnalytics: true,
        allowPublicWidgets: true,
        updatedAt: now,
      }),
    );

    await moduleRepo.save(
      moduleRepo.create({
        guildId: guild.id,
        moduleKey: 'Counters',
        enabled: true,
        hasError: false,
      }),
    );

    for (const eventType of ['message_delete', 'member_join', 'member_leave'] as const) {
      await logRepo.save(
        logRepo.create({
          guildId: guild.id,
          eventType,
          channelId: snowflake(),
          enabled: true,
          updatedAt: now,
        }),
      );
    }

    const templates = ['Members: {count}', 'Online: {count}', 'Messages: {count}'];
    const metrics = [CounterMetric.MEMBERS, CounterMetric.ONLINE, CounterMetric.MESSAGES];
    for (let c = 0; c < 3; c++) {
      const counter = counterRepo.create({
        guildId: guild.id,
        channelId: snowflake(),
        channelName: templates[c].replace('{count}', '0'),
        type: CounterType.STAT,
        metric: metrics[c],
        template: templates[c],
        status: CounterStatus.ACTIVE,
        currentValue: null,
        target: null,
        timezone: null,
        dateFormat: null,
        createdAt: now,
        updatedAt: now,
      });
      await counterRepo.save(counter);
      if (i === 0) {
        firstGuildCounters.push(counter);
      }
    }
  }
  console.log(`${guilds.length} guilds with settings, modules, logs, counters created`);

  return { users, companies, guilds, counters: firstGuildCounters, rawEventsCount: 0 };
}

async function seedClickHouse(
  ch: ClickHouseClient,
  guilds: Guild[],
  users: User[],
): Promise<number> {
  const db = process.env['CLICKHOUSE_DB'] ?? 'default';
  const table = `${db}.raw_events`;

  const guildsWithPlanTier = guilds.map((g, i) => ({
    guild: g,
    planTier: i === 0 ? 'premium' as const : 'free' as const,
  }));

  const discordUserIds = users.filter((u) => u.discordId).map((u) => u.discordId as string);
  while (discordUserIds.length < 5) {
    discordUserIds.push(snowflake());
  }

  const BATCH_SIZE = 1000;
  let totalEvents = 0;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  for (const { guild, planTier } of guildsWithPlanTier) {
    const anchorCount = Math.min(3, discordUserIds.length);
    const anchorIds = discordUserIds.slice(0, anchorCount);
    const otherIds = discordUserIds.slice(anchorCount);

    let batch: Record<string, unknown>[] = [];

    for (let d = 0; d < 30; d++) {
      const dayStart = new Date(thirtyDaysAgo);
      dayStart.setUTCDate(dayStart.getUTCDate() + d);
      dayStart.setUTCHours(0, 0, 0, 0);

      const numConversations = faker.number.int({ min: 5, max: 10 });
      for (let conv = 0; conv < numConversations; conv++) {
        const convHour = weightedRandomHour();
        const convStart = new Date(dayStart);
        convStart.setUTCHours(convHour, faker.number.int({ min: 0, max: 45 }), 0, 0);
        const numMessages = faker.number.int({ min: 10, max: 20 });
        const participants = anchorIds.length >= 2
          ? [anchorIds[0], anchorIds[1], anchorIds[2] ?? anchorIds[0]]
          : anchorIds;

        for (let m = 0; m < numMessages; m++) {
          const msgTime = new Date(convStart.getTime() + m * 60000);
          const useAnchor = Math.random() < 0.7;
          const discordUserId = useAnchor
            ? participants[faker.number.int({ min: 0, max: participants.length - 1 })]
            : otherIds[faker.number.int({ min: 0, max: Math.max(0, otherIds.length - 1) })] ?? participants[0];
          const eventTime = msgTime.toISOString();
          const retentionUntil = computeRetentionUntil(eventTime, planTier);

          batch.push({
            event_id: randomUUID(),
            event_time: toClickHouseDateTime(eventTime),
            event_date: eventTime.slice(0, 10),
            event_type: 'MESSAGE_CREATE',
            guild_id: guild.id,
            discord_guild_id: guild.discordGuildId,
            user_id: null,
            discord_user_id: discordUserId,
            anonymized_hash: null,
            channel_id: snowflake(),
            role_id: '',
            command_name: '',
            plan_tier: planTier,
            is_bot_generated: 0,
            payload: JSON.stringify({ channelId: snowflake() }),
            ingested_at: toClickHouseDateTime(now.toISOString()),
            retention_until: toClickHouseDateTime(retentionUntil.toISOString()),
            is_historical: 1,
          });
          totalEvents++;

          if (batch.length >= BATCH_SIZE) {
            await ch.insert({
              table,
              values: batch,
              format: 'JSONEachRow',
            });
            batch = [];
          }
        }
      }

      const numVoiceSessions = faker.number.int({ min: 3, max: 8 });
      for (let v = 0; v < numVoiceSessions; v++) {
        const vHour = weightedRandomHour();
        const joinTime = new Date(dayStart);
        joinTime.setUTCHours(vHour, faker.number.int({ min: 0, max: 59 }), 0, 0);
        const durationMinutes = faker.number.int({ min: 10, max: 120 });
        const leaveTime = new Date(joinTime.getTime() + durationMinutes * 60 * 1000);
        const useAnchor = Math.random() < 0.7;
        const discordUserId = useAnchor
          ? anchorIds[faker.number.int({ min: 0, max: anchorIds.length - 1 })]
          : otherIds[faker.number.int({ min: 0, max: Math.max(0, otherIds.length - 1) })] ?? anchorIds[0];

        const retentionUntil = computeRetentionUntil(leaveTime.toISOString(), planTier);
        batch.push({
          event_id: randomUUID(),
          event_time: toClickHouseDateTime(leaveTime.toISOString()),
          event_date: leaveTime.toISOString().slice(0, 10),
          event_type: 'VOICE_STATE_UPDATE',
          guild_id: guild.id,
          discord_guild_id: guild.discordGuildId,
          user_id: null,
          discord_user_id: discordUserId,
          anonymized_hash: null,
          channel_id: snowflake(),
          role_id: '',
          command_name: '',
          plan_tier: planTier,
          is_bot_generated: 0,
          payload: JSON.stringify({ voiceMinutes: durationMinutes }),
          ingested_at: toClickHouseDateTime(now.toISOString()),
          retention_until: toClickHouseDateTime(retentionUntil.toISOString()),
          is_historical: 1,
        });
        totalEvents++;

        if (batch.length >= BATCH_SIZE) {
          await ch.insert({
            table,
            values: batch,
            format: 'JSONEachRow',
          });
          batch = [];
        }
      }
    }

    if (batch.length > 0) {
      await ch.insert({
        table,
        values: batch,
        format: 'JSONEachRow',
      });
    }
  }

  const mvTables = ['mv_daily_activity', 'mv_heatmap', 'mv_voice_stats', 'mv_top_members', 'mv_role_stats', 'mv_command_stats', 'mv_top_channels_messages', 'mv_top_channels_voice'];
  for (const mv of mvTables) {
    try {
      await ch.command({
        query: `OPTIMIZE TABLE ${db}.${mv} FINAL`,
        clickhouse_settings: { wait_end_of_query: 1 },
      });
    } catch {
    }
  }
  await ch.command({
    query: `OPTIMIZE TABLE ${db}.raw_events FINAL`,
    clickhouse_settings: { wait_end_of_query: 1 },
  });

  return totalEvents;
}

async function seedRedisHeartbeats(redis: Redis): Promise<void> {
  const ttl = 120;
  for (let i = 0; i < 2; i++) {
    const key = `bot-service:shard:${i}`;
    await redis.hset(key, 'status', 'READY', 'timestamp', String(Date.now()), 'guildCount', '2', 'ping', '50');
    await redis.expire(key, ttl);
  }
  console.log('Redis shard heartbeats created');
}

async function main(): Promise<void> {
  const clean = process.argv.includes('--clean');

  const encryptionKey = process.env['ENCRYPTION_KEY_V1'];
  if (!encryptionKey || encryptionKey.length !== 32) {
    console.error('ENCRYPTION_KEY_V1 must be exactly 32 characters in .env');
    process.exit(1);
  }

  const chHost = process.env['CLICKHOUSE_HOST'] ?? 'localhost';
  const chPort = process.env['CLICKHOUSE_PORT'] ?? '8123';
  const chUrl = chHost.startsWith('http') ? chHost : `http://${chHost}:${chPort}`;
  const ch = createClient({
    url: chUrl,
    database: process.env['CLICKHOUSE_DB'] ?? 'default',
    username: process.env['CLICKHOUSE_USER'] ?? 'default',
    password: process.env['CLICKHOUSE_PASSWORD'] ?? '',
  });

  const redis = new Redis({
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    password: process.env['REDIS_PASSWORD'] ?? undefined,
    keyPrefix: `sn:${envPrefix()}:`,
  });

  await AppDataSource.initialize();

  try {
    await runClickHouseMigrations(ch);

    if (clean) {
      await runCleanup(AppDataSource, ch, redis);
    }

    const result = await seedPostgres(AppDataSource, encryptionKey);
    const rawCount = await seedClickHouse(ch, result.guilds, result.users);
    await seedRedisHeartbeats(redis);

    const firstGuild = result.guilds[0];
    const seedOutput: SeedOutput = {
      frontendUser: { email: 'smoke@server-ninja.local', password: 'SmokeTest1!' },
      adminUser: { email: 'admin@server-ninja.local', password: 'Admin123!' },
      guilds: result.guilds.map((g) => ({ discordGuildId: g.discordGuildId, id: g.id })),
      companyId: result.companies[0].id,
      counters: result.counters.map((c) => ({
        id: c.id,
        guildDiscordId: firstGuild.discordGuildId,
      })),
    };
    const outputPath = resolve(process.cwd(), 'scripts', 'seed-output.json');
    writeFileSync(outputPath, JSON.stringify(seedOutput, null, 2), 'utf8');
    console.log(`Seed output written to ${outputPath}`);

    console.log('\n--- Seed complete ---');
    console.log(`Users: ${result.users.length}`);
    console.log(`Companies: ${result.companies.length}`);
    console.log(`Guilds: ${result.guilds.length}`);
    console.log(`Counters: ${result.guilds.length * 3}`);
    console.log(`Raw events: ${rawCount}`);
  } finally {
    await AppDataSource.destroy();
    await ch.close();
    redis.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
