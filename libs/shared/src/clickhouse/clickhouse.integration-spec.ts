import { ClickHouseContainer } from '@testcontainers/clickhouse';
import { setTestIntegrationEnv } from '../test-integration-env';

function parseHttpUrl(url: string): { host: string; port: number } {
  const u = new URL(url);
  return { host: u.hostname, port: parseInt(u.port || '8123', 10) };
}

describe('ClickHouse integration (schema)', () => {
  let container: { stop: () => Promise<unknown> };
  let clickhouse: import('./clickhouse.service').ClickHouseService;

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
      CLICKHOUSE_DB: opts.database ?? 'default',
    });

    const { Test } = await import('@nestjs/testing');
    const { SharedConfigModule } = await import('../config/shared-config.module');
    const { ClickHouseModule } = await import('./clickhouse.module');
    const { ClickHouseService } = await import('./clickhouse.service');

    const mod = await Test.createTestingModule({
      imports: [SharedConfigModule, ClickHouseModule.forRootAsync()],
    }).compile();

    const svc = mod.get(ClickHouseService);
    await (svc as unknown as { onModuleInit: () => Promise<void> }).onModuleInit();
    clickhouse = svc;
  }, 90_000);

  afterAll(async () => {
    if (container) await container.stop();
  });

  it('creates raw_events and materialized views', async () => {
    const db = process.env['CLICKHOUSE_DB'] ?? 'default';
    const r = await clickhouse.query({
      query: `SELECT name FROM system.tables WHERE database = {db:String} AND name IN ('raw_events', 'mv_daily_activity', 'mv_heatmap', 'mv_role_stats', 'mv_command_stats', 'mv_voice_stats', 'mv_top_members')`,
      query_params: { db },
    });

    const j = await r.json();
    const data = Array.isArray(j) ? j : (j as { data?: { name: string }[] }).data ?? [];
    const names = (data as { name: string }[]).map((x) => x.name);
    expect(names).toContain('raw_events');
    expect(names).toContain('mv_daily_activity');
    expect(names).toContain('mv_heatmap');
    expect(names).toContain('mv_role_stats');
    expect(names).toContain('mv_command_stats');
    expect(names).toContain('mv_voice_stats');
    expect(names).toContain('mv_top_members');
  });
});
