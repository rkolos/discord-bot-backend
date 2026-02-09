/**
 * Проверка данных для Activity Chart (timeSeries): messages, members, voiceMinutes по дням.
 * Member Activity использует поле members (уникальные активные участники за день).
 * Запрос к raw_events. Запуск: npx ts-node scripts/check-activity-chart.ts [discordGuildId] [days]
 * Пример: npx ts-node scripts/check-activity-chart.ts 1392546208903335996 30
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@clickhouse/client';
import { AppDataSource } from '../libs/shared/src/database/data-source';
import { Guild } from '../libs/shared/src/database/entities';

config({ path: resolve(process.cwd(), '.env') });

const DISCORD_GUILD_ID = process.argv[2] ?? '1392546208903335996';
const DAYS = parseInt(process.argv[3] ?? '30', 10) || 30;

async function main(): Promise<void> {
  await AppDataSource.initialize();
  const guildRepo = AppDataSource.getRepository(Guild);
  const guild = await guildRepo.findOne({
    where: { discordGuildId: DISCORD_GUILD_ID },
    select: ['id', 'name', 'discordGuildId'],
  });
  if (!guild) {
    console.error(`Guild not found for discord_guild_id=${DISCORD_GUILD_ID}`);
    await AppDataSource.destroy();
    process.exit(1);
  }
  console.log(`Guild: ${guild.name} (discord: ${guild.discordGuildId}, uuid: ${guild.id})`);
  console.log(`Period: last ${DAYS} days from today (raw_events)\n`);

  const db = process.env['CLICKHOUSE_DB'] ?? 'default';
  const host = process.env['CLICKHOUSE_HOST'] ?? 'localhost';
  const port = process.env['CLICKHOUSE_PORT'] ?? '8123';
  const client = createClient({
    url: `http://${host}:${port}`,
    username: process.env['CLICKHOUSE_USER'] ?? 'default',
    password: process.env['CLICKHOUSE_PASSWORD'] ?? '',
    database: db,
  });

  try {
    const sampleResult = await client.query({
      query: `
        SELECT event_date, event_type, user_id, discord_user_id
        FROM ${db}.raw_events
        WHERE guild_id = {guildId:UUID}
        LIMIT 5
      `,
      query_params: { guildId: guild.id },
      format: 'JSONEachRow',
    });
    const sampleRows = (await sampleResult.json()) as Array<{
      event_date: string;
      event_type: string;
      user_id: string | null;
      discord_user_id: string;
    }>;
    const sample = Array.isArray(sampleRows) ? sampleRows : [];
    if (sample.length > 0) {
      console.log('Sample raw_events rows (user_id, discord_user_id):');
      sample.forEach((r) =>
        console.log(`  ${r.event_date} ${r.event_type} user_id=${r.user_id ?? 'null'} discord_user_id=${r.discord_user_id === '' ? '(empty)' : r.discord_user_id}`),
      );
      console.log('');
    }

    const result = await client.query({
      query: `
        SELECT
          event_date AS date,
          countIf(event_type = 'MESSAGE_CREATE') AS messages,
          uniqCombinedIf(if(empty(discord_user_id), toString(user_id), discord_user_id), (discord_user_id != '' OR user_id IS NOT NULL)) AS members,
          sumIf(toUInt64(JSONExtractInt(payload, 'voiceMinutes')), event_type = 'VOICE_STATE_UPDATE') AS voiceMinutes
        FROM ${db}.raw_events
        WHERE guild_id = {guildId:UUID}
          AND event_date >= toDate(now()) - {days:UInt32}
          AND event_date <= toDate(now())
        GROUP BY guild_id, event_date
        ORDER BY event_date ASC
      `,
      query_params: { guildId: guild.id, days: DAYS },
      format: 'JSONEachRow',
    });
    const rows = (await result.json()) as Array<{
      date: string;
      messages: string | number;
      members: string | number;
      voiceMinutes: string | number;
    }>;
    const data = Array.isArray(rows) ? rows : [];
    if (data.length === 0) {
      console.log('No rows in raw_events for this guild in the period. Member Activity will be empty.');
      await AppDataSource.destroy();
      await client.close();
      return;
    }
    console.log(`Days with data: ${data.length}`);
    console.log('Sample (first 10 days, columns: date, messages, members, voiceMinutes):');
    data.slice(0, 10).forEach((r) => {
      console.log(
        `  ${String(r.date)}  messages=${Number(r.messages)}  members=${Number(r.members)}  voiceMinutes=${Number(r.voiceMinutes)}`,
      );
    });
    const totalMembers = data.reduce((acc, r) => acc + Number(r.members ?? 0), 0);
    const daysWithMembers = data.filter((r) => Number(r.members ?? 0) > 0).length;
    console.log(`\nTotal days with members > 0: ${daysWithMembers} of ${data.length}`);
    console.log(`Sum of members (across days): ${totalMembers} (for reference)`);
  } finally {
    await client.close();
  }
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
