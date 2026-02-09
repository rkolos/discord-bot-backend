/**
 * Проверка данных очередей: подключается к Redis с теми же настройками, что и Admin API,
 * запрашивает метрики всех очередей и выводит JSON в формате ответа GET /api/system/queues.
 * Запуск: npx ts-node scripts/check-queues-metrics.ts
 * Требует: .env с REDIS_HOST, REDIS_PORT, NODE_ENV (опционально)
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { Queue } from 'bullmq';

config({ path: resolve(process.cwd(), '.env') });

const NODE_ENV_TO_PREFIX: Record<string, string> = {
  development: 'dev',
  production: 'prod',
  stage: 'stage',
  test: 'test',
};

const ALL_QUEUE_NAMES = [
  'workers-queue-counters-update',
  'workers-queue-guild-setup',
  'workers-queue-history-sync',
  'ingestor-raw-events',
  'workers-queue-logs-config',
  'workers-queue-welcome-goodbye-config',
  'workers-queue-gdpr-user-delete',
] as const;

async function main(): Promise<void> {
  const nodeEnv = process.env['NODE_ENV'] ?? 'development';
  const envShort = NODE_ENV_TO_PREFIX[nodeEnv] ?? 'dev';
  const prefix = `sn:${envShort}:`;
  const host = process.env['REDIS_HOST'] ?? 'localhost';
  const port = parseInt(process.env['REDIS_PORT'] ?? '6379', 10);
  const password = process.env['REDIS_PASSWORD'] ?? undefined;

  console.error(`Redis: ${host}:${port}, prefix: "${prefix}" (NODE_ENV=${nodeEnv})\n`);

  const queues: Queue[] = [];
  for (const name of ALL_QUEUE_NAMES) {
    queues.push(
      new Queue(name, {
        connection: { host, port, password },
        prefix,
      }),
    );
  }

  const result: Array<{
    queueName: string;
    active: number;
    waiting: number;
    delayed: number;
    failed: number;
    paused: boolean;
  }> = [];

  for (let i = 0; i < ALL_QUEUE_NAMES.length; i++) {
    const name = ALL_QUEUE_NAMES[i];
    const queue = queues[i];
    try {
      const counts = await queue.getJobCounts();
      const isPaused = await queue.isPaused();
      result.push({
        queueName: name,
        active: counts.active ?? 0,
        waiting: counts.waiting ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
        paused: isPaused,
      });
    } catch (err) {
      console.error(`Error for queue ${name}:`, err);
      result.push({
        queueName: name,
        active: 0,
        waiting: 0,
        delayed: 0,
        failed: 0,
        paused: false,
      });
    }
  }

  for (const q of queues) {
    await q.close();
  }

  // Формат ответа GET /api/system/queues
  console.log(JSON.stringify({ data: result }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
