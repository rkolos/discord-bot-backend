/**
 * Проверка heatmap для гильдии по Discord guild ID.
 * Использует PostgreSQL (guild.id по discord_guild_id) и ClickHouse (mv_heatmap).
 * Запуск: npx ts-node scripts/check-heatmap.ts <discordGuildId>
 * Пример: npx ts-node scripts/check-heatmap.ts 1392546208903335996
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@clickhouse/client';
import { AppDataSource } from '../libs/shared/src/database/data-source';
import { Guild } from '../libs/shared/src/database/entities';

config({ path: resolve(process.cwd(), '.env') });

const DISCORD_GUILD_ID = process.argv[2] ?? '1392546208903335996';

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

  const db = process.env['CLICKHOUSE_DB'] ?? process.env['CLICKHOUSE_DB'] ?? 'default';
  const host = process.env['CLICKHOUSE_HOST'] ?? 'localhost';
  const port = process.env['CLICKHOUSE_PORT'] ?? '8123';
  const client = createClient({
    url: `http://${host}:${port}`,
    username: process.env['CLICKHOUSE_USER'] ?? 'default',
    password: process.env['CLICKHOUSE_PASSWORD'] ?? '',
    database: db,
  });

  try {
    const result = await client.query({
      query: `
        SELECT
          toUInt8(day_of_week % 7) AS day_of_week,
          toUInt8(hour) AS hour,
          sum(events_count) AS value
        FROM ${db}.mv_heatmap
        WHERE guild_id = {guildId:UUID}
        GROUP BY guild_id, day_of_week, hour
      `,
      query_params: { guildId: guild.id },
      format: 'JSONEachRow',
    });
    const rows = (await result.json()) as Array<{
      day_of_week: number;
      hour: number;
      value: string | number;
    }>;
    const data = Array.isArray(rows) ? rows : [];
    const map = new Map<string, number>();
    for (const row of data) {
      const d = Number(row.day_of_week ?? 0);
      const h = Number(row.hour ?? 0);
      if (d >= 0 && d <= 6 && h >= 0 && h <= 23) {
        map.set(`${d}-${h}`, Number(row.value ?? 0));
      }
    }
    const totalValue = [...map.values()].reduce((a, b) => a + b, 0);
    const nonZero = [...map.entries()].filter(([, v]) => v > 0);
    console.log(`Heatmap: ${data.length} rows from ClickHouse, total events (messages): ${totalValue}`);
    console.log(`Non-zero cells: ${nonZero.length} of 168`);
    if (nonZero.length > 0) {
      const sorted = nonZero.sort((a, b) => b[1] - a[1]).slice(0, 15);
      console.log('Top 15 cells (dayOfWeek, hour, value):');
      for (const [key, value] of sorted) {
        const [d, h] = key.split('-').map(Number);
        console.log(`  dayOfWeek=${d} hour=${h} value=${value}`);
      }
    }
    const fullGrid: Array<{ dayOfWeek: number; hour: number; value: number }> = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      for (let hour = 0; hour < 24; hour++) {
        fullGrid.push({
          dayOfWeek,
          hour,
          value: map.get(`${dayOfWeek}-${hour}`) ?? 0,
        });
      }
    }
    console.log(`API would return ${fullGrid.length} cells (7×24).`);
  } finally {
    await client.close();
  }
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
