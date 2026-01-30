/**
 * Jest globalSetup: проверяет доступность Redis; при отсутствии поднимает контейнер.
 * Пишет .jest-redis-env.json с REDIS_HOST, REDIS_PORT и флагом JEST_REDIS_STARTED_BY_US.
 */
const path = require('path');
const fs = require('fs');

// Colima/Docker: globalSetup выполняется в отдельном процессе, нужен DOCKER_HOST для Testcontainers
const home = process.env.HOME || process.env.USERPROFILE;
if (home && !process.env.DOCKER_HOST) {
  const colimaDefault = path.join(home, '.colima', 'default', 'docker.sock');
  const colimaRoot = path.join(home, '.colima', 'docker.sock');
  if (fs.existsSync(colimaDefault)) {
    process.env.DOCKER_HOST = `unix://${colimaDefault}`;
    process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE = '/var/run/docker.sock';
  } else if (fs.existsSync(colimaRoot)) {
    process.env.DOCKER_HOST = `unix://${colimaRoot}`;
    process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE = '/var/run/docker.sock';
  }
}

const ENV_FILE = path.join(__dirname, '..', '.jest-redis-env.json');
const CONNECT_TIMEOUT_MS = 3000;

function tryConnectRedis(host, port) {
  return new Promise((resolve) => {
    const Redis = require('ioredis');
    const client = new Redis({
      host,
      port: Number(port),
      connectTimeout: CONNECT_TIMEOUT_MS,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    const timeout = setTimeout(() => {
      client.disconnect();
      resolve(false);
    }, CONNECT_TIMEOUT_MS);
    client.once('ready', () => {
      clearTimeout(timeout);
      client.quit().then(() => resolve(true)).catch(() => resolve(true));
    });
    client.once('error', () => {
      clearTimeout(timeout);
      client.disconnect();
      resolve(false);
    });
  });
}

async function globalSetup() {
  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = process.env.REDIS_PORT || '6379';

  const connected = await tryConnectRedis(host, port);
  if (connected) {
    fs.writeFileSync(
      ENV_FILE,
      JSON.stringify({
        REDIS_HOST: host,
        REDIS_PORT: port,
        JEST_REDIS_STARTED_BY_US: false,
      }),
      'utf8',
    );
    return;
  }

  const { RedisContainer } = require('@testcontainers/redis');
  const started = await new RedisContainer('redis:7-alpine').start();
  const containerId = started.getId();

  fs.writeFileSync(
    ENV_FILE,
    JSON.stringify({
      REDIS_HOST: started.getHost(),
      REDIS_PORT: String(started.getPort()),
      JEST_REDIS_STARTED_BY_US: true,
      JEST_REDIS_CONTAINER_ID: containerId,
    }),
    'utf8',
  );
}

module.exports = globalSetup;
