/**
 * Debug script: authenticate and open realtime WebSocket.
 * Logs every step for debugging frontend socket connection issues.
 * Reference implementation for frontend — working code to compare against.
 *
 * Run: npm run auth-and-socket
 * Requires: frontend-api running (e.g. on 3001). No seed or manual credentials needed.
 *
 * To debug receiving guild-state for a specific guild (e.g. server/1392546208903335996/):
 *   SUBSCRIBE_GUILD_IDS=1392546208903335996 npm run auth-and-socket
 * The user must be owner or guild admin of that guild; then send a message in Discord to trigger lastActivity.
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { io } from 'socket.io-client';

config({ path: resolve(process.cwd(), '.env') });

const API_BASE = process.env['FRONTEND_API_URL'] ?? 'http://localhost:3001';

// Fixed test user — script registers or logs in with these
const DEFAULT_FULL_NAME = 'Script Realtime User';
const DEFAULT_EMAIL = 'script-realtime@example.com';
const DEFAULT_PASSWORD = 'ScriptRealtime1!';

function log(msg: string, data?: Record<string, unknown>): void {
  const line = data ? `${msg} ${JSON.stringify(data)}` : msg;
  console.log(`[auth-and-socket] ${line}`);
}

interface Envelope {
  data?: { token?: string; accessToken?: string; user?: unknown; items?: Array<{ id: string }> };
  error?: { message?: string; code?: string };
}

async function getToken(): Promise<string> {
  const useEnv =
    process.env['SCRIPT_USER_EMAIL'] && process.env['SCRIPT_USER_PASSWORD'];
  const email = process.env['SCRIPT_USER_EMAIL'] ?? DEFAULT_EMAIL;
  const password = process.env['SCRIPT_USER_PASSWORD'] ?? DEFAULT_PASSWORD;

  log('Start', {
    API_BASE,
    credentialsSource: useEnv ? 'env' : 'fixed test user',
  });

  if (!useEnv) {
    // Try register first
    const registerUrl = `${API_BASE.replace(/\/$/, '')}/api/auth/register`;
    log('Register request', { url: registerUrl });
    const registerRes = await fetch(registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: DEFAULT_FULL_NAME,
        email: DEFAULT_EMAIL,
        password: DEFAULT_PASSWORD,
      }),
    });
    const registerBody = (await registerRes.json()) as Envelope;
    log('Register response', { status: registerRes.status, hasData: !!registerBody.data });

    if (registerRes.ok && registerBody.data?.token) {
      log(`Token received (length: ${registerBody.data.token.length})`);
      return registerBody.data.token;
    }
    if (registerRes.status === 409 || (registerBody.error?.message ?? '').toLowerCase().includes('already exists')) {
      log('User already exists, will login');
    } else if (registerBody.error) {
      log('Register error', { error: registerBody.error });
    }
  }

  // Login
  const loginUrl = `${API_BASE.replace(/\/$/, '')}/api/auth/login`;
  log('Login request', { url: loginUrl });
  const loginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = (await loginRes.json()) as Envelope;
  log('Login response', { status: loginRes.status, hasData: !!loginBody.data });

  const token = loginBody.data?.token ?? loginBody.data?.accessToken;
  if (!token) {
    log('Login failed', { error: loginBody.error ?? 'No token in response' });
    process.exit(1);
  }
  log(`Token received (length: ${token.length})`);
  return token;
}

async function fetchGuildIds(token: string): Promise<string[]> {
  const url = `${API_BASE.replace(/\/$/, '')}/api/me/guilds`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { data?: Array<{ id: string }> };
  const items = Array.isArray(body.data) ? body.data : [];
  return items.map((g) => g.id).filter(Boolean);
}

/** Parse SUBSCRIBE_GUILD_IDS env (comma-separated Discord guild snowflakes) for debugging. */
function getExtraGuildIds(): string[] {
  const raw = process.env['SUBSCRIBE_GUILD_IDS'];
  if (!raw || typeof raw !== 'string') return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

async function main(): Promise<void> {
  const token = await getToken();

  const socketUrl = `${API_BASE.replace(/\/$/, '')}/guild-state`;
  log('Connecting to socket', {
    url: socketUrl,
    path: '/api/realtime',
    authTokenLength: token.length,
  });

  const socket = io(socketUrl, {
    path: '/api/realtime',
    auth: { token },
  });

  const ingest = (message: string, data: Record<string, unknown>) => {
    fetch('http://127.0.0.1:7244/ingest/d16c2cb1-2d26-4721-b47a-e24e77eb49f5', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'auth-and-socket.ts', message, data: { ...data, timestamp: Date.now() }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'script' }) }).catch(() => {});
  };

  socket.on('connect', async () => {
    log('connect');
    ingest('script connect', { event: 'connect' });
    const fromApi = await fetchGuildIds(token);
    const extra = getExtraGuildIds();
    const guildIds = [...new Set([...fromApi, ...extra])];
    if (extra.length > 0) {
      log('Subscribe guilds (from /me/guilds + SUBSCRIBE_GUILD_IDS)', { fromApi, extra, guildIds });
    } else {
      log('Emitting subscribe with guildIds', { guildIds });
    }
    socket.emit('subscribe', { guildIds });
    ingest('script subscribe emitted', { guildIdsCount: guildIds.length, guildIds });
  });

  socket.on('connect_error', (err: Error) => {
    log('connect_error', { message: err.message });
    ingest('script connect_error', { message: err.message });
    process.exit(1);
  });

  socket.on('disconnect', (reason: string) => {
    log('disconnect', { reason });
    ingest('script disconnect', { reason });
  });

  let guildStateCount = 0;
  socket.on('guild-state', (payload: unknown) => {
    guildStateCount += 1;
    const p = payload as { guildId?: string; parameter?: string; value?: unknown } | null;
    log(`guild-state #${guildStateCount}`, {
      guildId: p?.guildId,
      parameter: p?.parameter,
      value: p?.value,
      full: payload,
    });
  });

  process.on('SIGINT', () => {
    socket.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[auth-and-socket] Fatal:', err);
  process.exit(1);
});
