/**
 * Smoke-тест: вызывает все эндпоинты Frontend и Admin API.
 * Требует: npm run seed (для seed-output.json), запущенные frontend-api и admin-api.
 * Запуск: npm run smoke-test
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'node:fs';

config({ path: resolve(process.cwd(), '.env') });

const FRONTEND_URL = process.env['FRONTEND_API_URL'] ?? 'http://localhost:3000';
const ADMIN_URL = process.env['ADMIN_API_URL'] ?? 'http://localhost:3001';

interface SeedOutput {
  frontendUser: { email: string; password: string };
  adminUser: { email: string; password: string };
  guilds: Array<{ discordGuildId: string; id: string }>;
  companyId: string;
  counters: Array<{ id: string; guildDiscordId: string }>;
}

interface RequestInfo {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

interface TestResult {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  ok: boolean;
  error?: string;
  requestInfo: RequestInfo;
  responseBody: string;
}

const report: string[] = [];
let passed = 0;
let failed = 0;
let skipped = 0;

function log(msg: string): void {
  report.push(msg);
  console.log(msg);
}

async function request(
  baseUrl: string,
  method: string,
  path: string,
  options?: { body?: unknown; token?: string; adminToken?: string },
): Promise<TestResult> {
  const start = Date.now();
  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options?.token) headers['Authorization'] = `Bearer ${options.token}`;
  if (options?.adminToken) headers['Authorization'] = `Bearer ${options.adminToken}`;

  const requestInfo: RequestInfo = {
    method,
    url,
    headers: { ...headers },
    body: options?.body,
  };

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
    const responseBody = await res.text();
    const durationMs = Date.now() - start;
    const ok = res.status >= 200 && res.status < 300;
    let error: string | undefined;
    if (!ok) {
      let errBody: { error?: { message?: string; code?: string } } = {};
      try {
        errBody = JSON.parse(responseBody);
      } catch {
        errBody = {};
      }
      error = errBody.error?.message ?? errBody.error?.code ?? responseBody.slice(0, 200);
    }
    return { method, path, status: res.status, durationMs, ok, error, requestInfo, responseBody };
  } catch (err) {
    const durationMs = Date.now() - start;
    return {
      method,
      path,
      status: 0,
      durationMs,
      ok: false,
      error: (err as Error).message,
      requestInfo,
      responseBody: '',
    };
  }
}

function formatResponseBody(text: string): string {
  if (!text) return '(empty)';
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text;
  }
}

function buildCurl(info: RequestInfo): string {
  const parts = ['curl', '-X', info.method];
  for (const [name, value] of Object.entries(info.headers ?? {})) {
    parts.push('-H', `"${name}: ${value.replace(/"/g, '\\"')}"`);
  }
  parts.push(`"${info.url}"`);
  if (info.body !== undefined) {
    const bodyStr = typeof info.body === 'string' ? info.body : JSON.stringify(info.body);
    parts.push('-d', `'${bodyStr.replace(/'/g, "'\\''")}'`);
  }
  return parts.join(' ');
}

function record(r: TestResult, api: 'Frontend' | 'Admin', skipReason?: string): void {
  log('');
  log(`--- ${r.method} ${r.path} [${api} API] ---`);
  log(`Request:`);
  log(`  URL: ${r.requestInfo.url}`);
  if (r.requestInfo.body !== undefined) {
    log(`  Body: ${JSON.stringify(r.requestInfo.body)}`);
  }
  log(`curl:`);
  log(`  ${buildCurl(r.requestInfo)}`);
  log(`Response (${r.status}, ${r.durationMs}ms):`);
  log(formatResponseBody(r.responseBody));

  if (skipReason) {
    skipped++;
    log(`[SKIP] ${skipReason}`);
  } else if (r.ok) {
    passed++;
    log(`[OK]`);
  } else {
    failed++;
    log(`[FAIL] ${r.error ?? 'unknown'}`);
  }
}

async function runFrontend(seed: SeedOutput): Promise<string | null> {
  const { discordGuildId } = seed.guilds[0];
  const counter = seed.counters[0];

  const health = await request(FRONTEND_URL, 'GET', '/health');
  record(health, 'Frontend');

  const features = await request(FRONTEND_URL, 'GET', '/api/features');
  record(features, 'Frontend');

  const pricing = await request(FRONTEND_URL, 'GET', '/api/pricing');
  record(pricing, 'Frontend');

  const socialProof = await request(FRONTEND_URL, 'GET', '/api/social-proof');
  record(socialProof, 'Frontend');

  const docsCat = await request(FRONTEND_URL, 'GET', '/api/docs/categories');
  record(docsCat, 'Frontend');

  const stats = await request(FRONTEND_URL, 'GET', '/api/stats');
  record(stats, 'Frontend');

  const loginRes = await request(FRONTEND_URL, 'POST', '/api/auth/login', {
    body: { email: seed.frontendUser.email, password: seed.frontendUser.password },
  });
  record(loginRes, 'Frontend');
  if (!loginRes.ok) return null;

  const loginBody = await (async () => {
    const r = await fetch(`${FRONTEND_URL.replace(/\/$/, '')}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: seed.frontendUser.email, password: seed.frontendUser.password }),
    });
    return r.json();
  })();
  const token = loginBody.data?.token ?? loginBody.data?.accessToken;
  if (!token) return null;

  const me = await request(FRONTEND_URL, 'GET', '/api/me', { token });
  record(me, 'Frontend');

  const meGuilds = await request(FRONTEND_URL, 'GET', '/api/me/guilds', { token });
  record(meGuilds, 'Frontend');

  const meTeam = await request(FRONTEND_URL, 'GET', '/api/me/team', { token });
  record(meTeam, 'Frontend');

  const meSub = await request(FRONTEND_URL, 'GET', '/api/me/subscription', { token });
  record(meSub, 'Frontend');

  const meUsage = await request(FRONTEND_URL, 'GET', '/api/me/usage', { token });
  record(meUsage, 'Frontend');

  const meInvoices = await request(FRONTEND_URL, 'GET', '/api/me/invoices', { token });
  record(meInvoices, 'Frontend');

  const companyGuilds = await request(
    FRONTEND_URL,
    'GET',
    `/api/companies/${seed.companyId}/guilds`,
    { token },
  );
  record(companyGuilds, 'Frontend');

  const guildSettings = await request(
    FRONTEND_URL,
    'GET',
    `/api/guilds/${discordGuildId}/settings`,
    { token },
  );
  record(guildSettings, 'Frontend');

  const patchSettings = await request(
    FRONTEND_URL,
    'PATCH',
    `/api/guilds/${discordGuildId}/settings`,
    { token, body: { serverName: 'Smoke Test Server' } },
  );
  record(patchSettings, 'Frontend');

  const guildModules = await request(
    FRONTEND_URL,
    'GET',
    `/api/guilds/${discordGuildId}/modules`,
    { token },
  );
  record(guildModules, 'Frontend');

  const patchModules = await request(
    FRONTEND_URL,
    'PATCH',
    `/api/guilds/${discordGuildId}/modules`,
    { token, body: { counters: true } },
  );
  record(patchModules, 'Frontend');

  const guildChannels = await request(
    FRONTEND_URL,
    'GET',
    `/api/guilds/${discordGuildId}/channels`,
    { token },
  );
  record(guildChannels, 'Frontend');

  const guildStats = await request(
    FRONTEND_URL,
    'GET',
    `/api/guilds/${discordGuildId}/stats`,
    { token },
  );
  record(guildStats, 'Frontend');

  const botStatus = await request(
    FRONTEND_URL,
    'GET',
    `/api/guilds/${discordGuildId}/bot-status`,
    { token },
  );
  record(botStatus, 'Frontend');

  const activitySparkline = await request(
    FRONTEND_URL,
    'GET',
    `/api/guilds/${discordGuildId}/activity-sparkline`,
    { token },
  );
  record(activitySparkline, 'Frontend');

  const toDate = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const analyticsCombined = await request(
    FRONTEND_URL,
    'GET',
    `/api/guilds/${discordGuildId}/analytics?from=${fromDate}&to=${toDate}`,
    { token },
  );
  record(analyticsCombined, 'Frontend');

  const analyticsOverview = await request(
    FRONTEND_URL,
    'GET',
    `/api/guilds/${discordGuildId}/analytics/overview`,
    { token },
  );
  record(analyticsOverview, 'Frontend');

  const activityChart = await request(
    FRONTEND_URL,
    'GET',
    `/api/guilds/${discordGuildId}/analytics/activity-chart?from=${fromDate}&to=${toDate}`,
    { token },
  );
  record(activityChart, 'Frontend');

  const topMembers = await request(
    FRONTEND_URL,
    'GET',
    `/api/guilds/${discordGuildId}/analytics/top-members`,
    { token },
  );
  record(topMembers, 'Frontend');

  const heatmap = await request(
    FRONTEND_URL,
    'GET',
    `/api/guilds/${discordGuildId}/heatmap`,
    { token },
  );
  record(heatmap, 'Frontend');

  const leaderboard = await request(
    FRONTEND_URL,
    'GET',
    `/api/guilds/${discordGuildId}/leaderboard`,
    { token },
  );
  record(leaderboard, 'Frontend');

  const countersGet = await request(
    FRONTEND_URL,
    'GET',
    `/api/guilds/${discordGuildId}/counters`,
    { token },
  );
  record(countersGet, 'Frontend');

  const counterPreview = await request(
    FRONTEND_URL,
    'POST',
    `/api/guilds/${discordGuildId}/counters/preview`,
    { token, body: { template: 'Members: {count}' } },
  );
  record(counterPreview, 'Frontend');

  const counterCreateBody = {
    channelId: '123456789012345679',
    type: 'stat',
    template: 'Smoke: {count}',
    metric: 'members',
  };
  const counterCreateStart = Date.now();
  const counterCreateRes = await fetch(
    `${FRONTEND_URL.replace(/\/$/, '')}/api/guilds/${discordGuildId}/counters`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(counterCreateBody),
    },
  );
  const counterCreateResBody = await counterCreateRes.text();
  const counterCreateOk = counterCreateRes.status >= 200 && counterCreateRes.status < 300;
  record({
    method: 'POST',
    path: `/api/guilds/${discordGuildId}/counters`,
    status: counterCreateRes.status,
    durationMs: Date.now() - counterCreateStart,
    ok: counterCreateOk,
    error: counterCreateOk ? undefined : counterCreateResBody.slice(0, 200),
    requestInfo: {
      method: 'POST',
      url: `${FRONTEND_URL.replace(/\/$/, '')}/api/guilds/${discordGuildId}/counters`,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: counterCreateBody,
    },
    responseBody: counterCreateResBody,
  }, 'Frontend');
  let newCounterId: string | undefined;
  if (counterCreateOk) {
    const createBody = JSON.parse(counterCreateResBody);
    newCounterId = createBody.data?.id;
  }

  const counterPatch = await request(
    FRONTEND_URL,
    'PATCH',
    `/api/guilds/${counter.guildDiscordId}/counters/${counter.id}`,
    { token, body: { template: 'Updated: {count}' } },
  );
  record(counterPatch, 'Frontend');

  if (newCounterId) {
    const counterDelete = await request(
      FRONTEND_URL,
      'DELETE',
      `/api/guilds/${discordGuildId}/counters/${newCounterId}`,
      { token },
    );
    record(counterDelete, 'Frontend');
  }

  const logsSettings = await request(
    FRONTEND_URL,
    'GET',
    `/api/guilds/${discordGuildId}/logs/settings`,
    { token },
  );
  record(logsSettings, 'Frontend');

  const logsPatch = await request(
    FRONTEND_URL,
    'PATCH',
    `/api/guilds/${discordGuildId}/logs/settings`,
    {
      token,
      body: {
        settings: [{ eventType: 'message_delete', channelId: '987654321098765432', enabled: true }],
      },
    },
  );
  record(logsPatch, 'Frontend');

  const logsEvents = await request(
    FRONTEND_URL,
    'GET',
    `/api/guilds/${discordGuildId}/logs/events`,
    { token },
  );
  record(logsEvents, 'Frontend');

  const widgetsGet = await request(
    FRONTEND_URL,
    'GET',
    `/api/guilds/${discordGuildId}/widgets`,
    { token },
  );
  record(widgetsGet, 'Frontend');

  const widgetCreateBody = { name: 'Smoke Del Widget', config: {} };
  const widgetCreateStart = Date.now();
  const widgetCreateRes = await fetch(
    `${FRONTEND_URL.replace(/\/$/, '')}/api/guilds/${discordGuildId}/widgets`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(widgetCreateBody),
    },
  );
  const widgetCreateResBody = await widgetCreateRes.text();
  const widgetCreateOk = widgetCreateRes.status >= 200 && widgetCreateRes.status < 300;
  record({
    method: 'POST',
    path: `/api/guilds/${discordGuildId}/widgets`,
    status: widgetCreateRes.status,
    durationMs: Date.now() - widgetCreateStart,
    ok: widgetCreateOk,
    error: widgetCreateOk ? undefined : widgetCreateResBody.slice(0, 200),
    requestInfo: {
      method: 'POST',
      url: `${FRONTEND_URL.replace(/\/$/, '')}/api/guilds/${discordGuildId}/widgets`,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: widgetCreateBody,
    },
    responseBody: widgetCreateResBody,
  }, 'Frontend');
  let newWidgetId: string | undefined;
  if (widgetCreateOk) {
    const wBody = JSON.parse(widgetCreateResBody);
    newWidgetId = wBody.data?.id;
  }

  if (newWidgetId) {
    const widgetPatch = await request(
      FRONTEND_URL,
      'PATCH',
      `/api/guilds/${discordGuildId}/widgets/${newWidgetId}`,
      { token, body: { name: 'Smoke Widget Updated' } },
    );
    record(widgetPatch, 'Frontend');

    const widgetDelete = await request(
      FRONTEND_URL,
      'DELETE',
      `/api/guilds/${discordGuildId}/widgets/${newWidgetId}`,
      { token },
    );
    record(widgetDelete, 'Frontend');
  }

  const guildsGet = await request(FRONTEND_URL, 'GET', '/api/guilds', { token });
  record(guildsGet, 'Frontend', !guildsGet.ok ? 'Requires Discord OAuth' : undefined);

  return token;
}

async function runAdmin(seed: SeedOutput): Promise<string | null> {
  const health = await request(ADMIN_URL, 'GET', '/health');
  record(health, 'Admin');

  const loginRes = await request(ADMIN_URL, 'POST', '/api/auth/login', {
    body: { email: seed.adminUser.email, password: seed.adminUser.password },
  });
  record(loginRes, 'Admin');
  if (!loginRes.ok) return null;

  const loginBody = await (async () => {
    const r = await fetch(`${ADMIN_URL.replace(/\/$/, '')}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: seed.adminUser.email, password: seed.adminUser.password }),
    });
    return r.json();
  })();
  const token = loginBody.data?.accessToken;
  if (!token) return null;

  const me = await request(ADMIN_URL, 'GET', '/api/auth/me', { adminToken: token });
  record(me, 'Admin');

  const dashboard = await request(ADMIN_URL, 'GET', '/api/dashboard/overview', {
    adminToken: token,
  });
  record(dashboard, 'Admin');

  const statsGrowth = await request(ADMIN_URL, 'GET', '/api/admin/stats/growth', {
    adminToken: token,
  });
  record(statsGrowth, 'Admin');

  const guildsList = await request(ADMIN_URL, 'GET', '/api/guilds', { adminToken: token });
  record(guildsList, 'Admin');

  const guildId = seed.guilds[0].id;
  const guildById = await request(ADMIN_URL, 'GET', `/api/guilds/${guildId}`, {
    adminToken: token,
  });
  record(guildById, 'Admin');

  const usersList = await request(ADMIN_URL, 'GET', '/api/users', { adminToken: token });
  record(usersList, 'Admin');

  const userId = await (async () => {
    const r = await fetch(`${ADMIN_URL.replace(/\/$/, '')}/api/users?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    return j.data?.[0]?.id;
  })();
  if (userId) {
    const userById = await request(ADMIN_URL, 'GET', `/api/users/${userId}`, {
      adminToken: token,
    });
    record(userById, 'Admin');
  }

  const analyticsCounters = await request(ADMIN_URL, 'GET', '/api/analytics/counters', {
    adminToken: token,
  });
  record(analyticsCounters, 'Admin');

  const analyticsWidgets = await request(ADMIN_URL, 'GET', '/api/analytics/widgets', {
    adminToken: token,
  });
  record(analyticsWidgets, 'Admin');

  const analyticsGrowth = await request(ADMIN_URL, 'GET', '/api/analytics/growth', {
    adminToken: token,
  });
  record(analyticsGrowth, 'Admin');

  const analyticsCommands = await request(ADMIN_URL, 'GET', '/api/analytics/commands', {
    adminToken: token,
  });
  record(analyticsCommands, 'Admin');

  const analyticsLeaderboards = await request(ADMIN_URL, 'GET', '/api/analytics/leaderboards', {
    adminToken: token,
  });
  record(analyticsLeaderboards, 'Admin');

  const systemHealth = await request(ADMIN_URL, 'GET', '/api/system/health/summary', {
    adminToken: token,
  });
  record(systemHealth, 'Admin');

  const systemShards = await request(ADMIN_URL, 'GET', '/api/system/shards', {
    adminToken: token,
  });
  record(systemShards, 'Admin');

  const systemQueues = await request(ADMIN_URL, 'GET', '/api/system/queues', {
    adminToken: token,
  });
  record(systemQueues, 'Admin');

  const systemStalled = await request(ADMIN_URL, 'GET', '/api/system/queues/stalled', {
    adminToken: token,
  });
  record(systemStalled, 'Admin');

  const restartShard = await request(ADMIN_URL, 'POST', '/api/system/shards/0/restart', {
    adminToken: token,
  });
  record(
    restartShard,
    'Admin',
    restartShard.status === 501 ? 'Not Implemented' : restartShard.status === 404 ? 'Shard not found' : undefined,
  );

  const botsRegister = await request(ADMIN_URL, 'POST', '/api/bots/commands/register', {
    adminToken: token,
    body: { token: 'test', scope: 'guild', guildId: seed.guilds[0].discordGuildId },
  });
  record(botsRegister, 'Admin', !botsRegister.ok ? 'May require Discord token' : undefined);

  const logout = await request(ADMIN_URL, 'POST', '/api/auth/logout', { adminToken: token });
  record(logout, 'Admin');

  return token;
}

async function main(): Promise<void> {
  const outputPath = resolve(process.cwd(), 'scripts', 'seed-output.json');
  let seed: SeedOutput;
  try {
    seed = JSON.parse(readFileSync(outputPath, 'utf8')) as SeedOutput;
  } catch {
    console.error('Run npm run seed first to create seed-output.json');
    process.exit(1);
  }

  log('=== Smoke Test Report ===');
  log(`Date: ${new Date().toISOString()}`);
  log(`Frontend API: ${FRONTEND_URL}`);
  log(`Admin API: ${ADMIN_URL}`);
  log('');

  log('--- Frontend API ---');
  await runFrontend(seed);
  log('');

  log('--- Admin API ---');
  await runAdmin(seed);
  log('');

  log('=== Summary ===');
  log(`Passed: ${passed}, Failed: ${failed}, Skipped: ${skipped}`);

  const reportPath = resolve(process.cwd(), 'smoke-test-report.txt');
  writeFileSync(reportPath, report.join('\n'), 'utf8');
  console.log(`\nReport written to ${reportPath}`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
