import { ClickHouseContainer } from '@testcontainers/clickhouse';
import { setTestIntegrationEnv } from '../../../../libs/shared/src/test-integration-env';

function parseHttpUrl(url: string): { host: string; port: number } {
  const u = new URL(url);
  return { host: u.hostname, port: parseInt(u.port || '8123', 10) };
}

describe('ClickHouse Ingestor integration (batch insert)', () => {
  let container: { stop: () => Promise<unknown> };
  let clickhouse: import('@app/shared').ClickHouseService;
  const db = 'default';

  beforeAll(async () => {
    const started = await new ClickHouseContainer(
      'clickhouse/clickhouse-server:22-alpine',
    ).start();
    container = started;

    const opts = started.getClientOptions();
    const url = opts.url ?? 'http://localhost:8123';
    const { host, port } = parseHttpUrl(url);

    setTestIntegrationEnv({
      CLICKHOUSE_HOST: host,
      CLICKHOUSE_PORT: port,
      CLICKHOUSE_USER: opts.username ?? 'default',
      CLICKHOUSE_PASSWORD: opts.password ?? 'default',
      CLICKHOUSE_DB: db,
    });

    const { Test } = await import('@nestjs/testing');
    const { SharedConfigModule } = await import('@app/shared');
    const { ClickHouseModule } = await import('@app/shared');
    const { ClickHouseService } = await import('@app/shared');

    const mod = await Test.createTestingModule({
      imports: [SharedConfigModule, ClickHouseModule.forRootAsync()],
    }).compile();

    clickhouse = mod.get(ClickHouseService);
    await (
      clickhouse as unknown as { onModuleInit: () => Promise<void> }
    ).onModuleInit();
  }, 90_000);

  afterAll(async () => {
    if (container) await container.stop();
  });

  it('raw_events exists and is queryable', async () => {
    const r = await clickhouse.query({
      query: `SELECT name FROM system.tables WHERE database = {db:String} AND name = 'raw_events'`,
      query_params: { db },
    });
    const j = (await r.json()) as { name: string }[] | { data?: { name: string }[] };
    const data = Array.isArray(j) ? j : (j as { data?: { name: string }[] }).data ?? [];
    expect((data as { name: string }[]).some((x) => x.name === 'raw_events')).toBe(true);
  });

  it('inserts batch of events into raw_events and they are readable', async () => {
    const nowRes = await clickhouse.query({
      query: 'SELECT now() AS t',
      query_params: {},
    });
    const nowJson = (await nowRes.json()) as { t: string }[] | { data?: { t: string }[] };
    const nowData = Array.isArray(nowJson) ? nowJson : (nowJson as { data?: { t: string }[] }).data ?? [];
    const chNow = (nowData[0] as { t: string } | undefined)?.t;
    const base = chNow ? new Date(chNow.replace(' ', 'T') + 'Z') : new Date('2025-01-15T12:00:00Z');
    const retentionUntil = new Date(base);
    retentionUntil.setUTCDate(retentionUntil.getUTCDate() + 30);
    const fmt = (d: Date) =>
      d.toISOString().slice(0, 19).replace('T', ' ').replace('Z', '');
    const eventTime = fmt(base);
    const eventDate = eventTime.slice(0, 10);

    const directRow = {
      event_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99',
      event_time: eventTime,
      event_date: eventDate,
      event_type: 'MESSAGE_CREATE',
      guild_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      discord_guild_id: '111222333444555678',
      user_id: null,
      discord_user_id: '999888777666555444',
      anonymized_hash: null,
      channel_id: '333444555666777890',
      role_id: '',
      command_name: '',
      plan_tier: 'free',
      is_bot_generated: 0,
      payload: '{"msg":"hello"}',
      ingested_at: eventTime,
      retention_until: fmt(retentionUntil),
      is_historical: 0,
    };
    const batch = [
      directRow,
      {
        ...directRow,
        event_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a98',
        event_time: eventTime,
        ingested_at: eventTime,
        retention_until: fmt(retentionUntil),
        plan_tier: 'pro',
        payload: '{}',
      },
    ];

    await clickhouse.insert({
      table: `${db}.raw_events`,
      values: batch,
      format: 'JSONEachRow',
      clickhouse_settings: { wait_for_async_insert: 1 },
    });

    await clickhouse.exec({
      query: `OPTIMIZE TABLE ${db}.raw_events FINAL`,
    });

    const rowsResult = await clickhouse.query({
      query: `SELECT event_id, event_type, guild_id, plan_tier, payload FROM ${db}.raw_events ORDER BY event_time LIMIT 10`,
      query_params: {},
    });
    const rowsJson = (await rowsResult.json()) as
      | { event_id: string; event_type: string; guild_id: string; plan_tier: string; payload: string }[]
      | { data?: { event_id: string; event_type: string; guild_id: string; plan_tier: string; payload: string }[] };
    type Row = { event_id: string; event_type: string; guild_id: string; plan_tier: string; payload: string };
    const rows: Row[] = Array.isArray(rowsJson)
      ? rowsJson
      : (rowsJson as { data?: Row[] }).data ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0].event_type).toBe('MESSAGE_CREATE');
    expect(rows[0].guild_id).toBe('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    expect(rows[0].plan_tier).toBe('free');
    expect(rows[0].payload).toContain('hello');
  });

  it('MV lifecycle: insert into raw_events then aggregated data appears in MV', async () => {
    const nowRes = await clickhouse.query({
      query: 'SELECT now() AS t',
      query_params: {},
    });
    const nowJson = (await nowRes.json()) as { t: string }[] | { data?: { t: string }[] };
    const nowData = Array.isArray(nowJson) ? nowJson : (nowJson as { data?: { t: string }[] }).data ?? [];
    const chNow = (nowData[0] as { t: string } | undefined)?.t;
    const base = chNow ? new Date(chNow.replace(' ', 'T') + 'Z') : new Date('2025-01-20T12:00:00Z');
    const retentionUntil = new Date(base);
    retentionUntil.setUTCDate(retentionUntil.getUTCDate() + 30);
    const fmt = (d: Date) =>
      d.toISOString().slice(0, 19).replace('T', ' ').replace('Z', '');
    const eventTime = fmt(base);
    const eventDate = eventTime.slice(0, 10);
    const guildId = 'd2eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
    const userId = 'e3eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

    const batch = [
      {
        event_id: 'f4eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
        event_time: eventTime,
        event_date: eventDate,
        event_type: 'MESSAGE_CREATE',
        guild_id: guildId,
        discord_guild_id: '222333444555666777',
        user_id: userId,
        discord_user_id: '888777666555444333',
        anonymized_hash: null,
        channel_id: '',
        role_id: '',
        command_name: '',
        plan_tier: 'free',
        is_bot_generated: 0,
        payload: '{}',
        ingested_at: eventTime,
        retention_until: fmt(retentionUntil),
        is_historical: 0,
      },
      {
        event_id: 'f4eebc99-9c0b-4ef8-bb6d-6bb9bd380a02',
        event_time: eventTime,
        event_date: eventDate,
        event_type: 'VOICE_STATE_UPDATE',
        guild_id: guildId,
        discord_guild_id: '222333444555666777',
        user_id: userId,
        discord_user_id: '888777666555444333',
        anonymized_hash: null,
        channel_id: '',
        role_id: '',
        command_name: '',
        plan_tier: 'free',
        is_bot_generated: 0,
        payload: '{"voiceMinutes":15}',
        ingested_at: eventTime,
        retention_until: fmt(retentionUntil),
        is_historical: 0,
      },
      {
        event_id: 'f4eebc99-9c0b-4ef8-bb6d-6bb9bd380a03',
        event_time: eventTime,
        event_date: eventDate,
        event_type: 'COMMAND_EXECUTED',
        guild_id: guildId,
        discord_guild_id: '222333444555666777',
        user_id: userId,
        discord_user_id: '888777666555444333',
        anonymized_hash: null,
        channel_id: '',
        role_id: '',
        command_name: 'stats',
        plan_tier: 'free',
        is_bot_generated: 0,
        payload: '{"isError":0}',
        ingested_at: eventTime,
        retention_until: fmt(retentionUntil),
        is_historical: 0,
      },
    ];

    await clickhouse.insert({
      table: `${db}.raw_events`,
      values: batch,
      format: 'JSONEachRow',
      clickhouse_settings: { wait_for_async_insert: 1 },
    });

    await clickhouse.exec({ query: `OPTIMIZE TABLE ${db}.raw_events FINAL` });
    await clickhouse.exec({ query: `OPTIMIZE TABLE ${db}.mv_daily_activity FINAL` });
    await clickhouse.exec({ query: `OPTIMIZE TABLE ${db}.mv_voice_stats FINAL` });
    await clickhouse.exec({ query: `OPTIMIZE TABLE ${db}.mv_command_stats FINAL` });
    await clickhouse.exec({ query: `OPTIMIZE TABLE ${db}.mv_top_members FINAL` });

    const dailyRes = await clickhouse.query({
      query: `SELECT guild_id, event_date, countIfMerge(messages_count) AS messages, uniqCombinedMerge(unique_users_count) AS users FROM ${db}.mv_daily_activity WHERE guild_id = {guildId:UUID} GROUP BY guild_id, event_date`,
      query_params: { guildId },
    });
    const dailyRows = (await dailyRes.json()) as { guild_id: string; event_date: string; messages: string; users: string }[];
    const dailyData = Array.isArray(dailyRows) ? dailyRows : (dailyRows as unknown as { data?: typeof dailyRows }).data ?? [];
    expect(dailyData.length).toBeGreaterThanOrEqual(1);
    expect(Number(dailyData[0]?.messages ?? 0)).toBeGreaterThanOrEqual(1);

    const voiceRes = await clickhouse.query({
      query: `SELECT guild_id, user_id, sum(voice_minutes) AS voice_minutes FROM ${db}.mv_voice_stats WHERE guild_id = {guildId:UUID} GROUP BY guild_id, user_id`,
      query_params: { guildId },
    });
    const voiceRows = (await voiceRes.json()) as { voice_minutes: string }[];
    const voiceData = Array.isArray(voiceRows) ? voiceRows : (voiceRows as unknown as { data?: typeof voiceRows }).data ?? [];
    expect(voiceData.length).toBeGreaterThanOrEqual(1);
    expect(Number(voiceData[0]?.voice_minutes ?? 0)).toBe(15);

    const cmdRes = await clickhouse.query({
      query: `SELECT guild_id, command_name, sum(execution_count) AS cnt FROM ${db}.mv_command_stats WHERE guild_id = {guildId:UUID} GROUP BY guild_id, command_name`,
      query_params: { guildId },
    });
    const cmdRows = (await cmdRes.json()) as { command_name: string; cnt: string }[];
    const cmdData = Array.isArray(cmdRows) ? cmdRows : (cmdRows as unknown as { data?: typeof cmdRows }).data ?? [];
    expect(cmdData.length).toBeGreaterThanOrEqual(1);
    expect(cmdData.some((r) => r.command_name === 'stats')).toBe(true);
  });

  it('timezone consistency: today from ClickHouse now() used for overview window', async () => {
    const nowRes = await clickhouse.query({
      query: 'SELECT now() AS t, toDate(now()) AS today',
      query_params: {},
    });
    const nowJson = (await nowRes.json()) as { t: string; today: string }[] | { data?: { t: string; today: string }[] };
    const nowData = Array.isArray(nowJson) ? nowJson : (nowJson as { data?: { t: string; today: string }[] }).data ?? [];
    const row = nowData[0] as { t: string; today: string } | undefined;
    expect(row).toBeDefined();
    expect(row?.today).toBeDefined();
    const todayStr = String(row?.today ?? '').slice(0, 10);
    expect(todayStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
