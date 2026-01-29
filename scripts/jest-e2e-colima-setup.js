/**
 * Setup for E2E tests: подставляет переменные для Colima (Docker без Docker Desktop).
 * Вызывается из jest.e2e.config.js перед запуском тестов.
 * Если сокет Colima есть — задаём DOCKER_HOST и TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE.
 */
const path = require('path');
const fs = require('fs');

const home = process.env.HOME || process.env.USERPROFILE;
if (!home) return;

const colimaDefaultSocket = path.join(home, '.colima', 'default', 'docker.sock');
const colimaSocket = path.join(home, '.colima', 'docker.sock');

if (process.env.DOCKER_HOST) return;

if (fs.existsSync(colimaDefaultSocket)) {
  process.env.DOCKER_HOST = `unix://${colimaDefaultSocket}`;
  process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE = '/var/run/docker.sock';
} else if (fs.existsSync(colimaSocket)) {
  process.env.DOCKER_HOST = `unix://${colimaSocket}`;
  process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE = '/var/run/docker.sock';
}

// Colima/Lima без IPv6: приоритет IPv4 для DNS (избегаем задержек/ошибок в контейнерах).
if (!process.env.NODE_OPTIONS) {
  process.env.NODE_OPTIONS = '--dns-result-order=ipv4first';
} else if (!process.env.NODE_OPTIONS.includes('dns-result-order')) {
  process.env.NODE_OPTIONS += ' --dns-result-order=ipv4first';
}
