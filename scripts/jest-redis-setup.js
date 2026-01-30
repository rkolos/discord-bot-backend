/**
 * Jest setupFiles: подставляет REDIS_HOST/REDIS_PORT из .jest-redis-env.json в process.env.
 * Вызывается в каждом воркере после globalSetup.
 */
const path = require('path');
const fs = require('fs');

const envFile = path.join(__dirname, '..', '.jest-redis-env.json');
if (!fs.existsSync(envFile)) return;

let data;
try {
  data = JSON.parse(fs.readFileSync(envFile, 'utf8'));
} catch {
  return;
}

if (data.REDIS_HOST !== undefined) process.env.REDIS_HOST = String(data.REDIS_HOST);
if (data.REDIS_PORT !== undefined) process.env.REDIS_PORT = String(data.REDIS_PORT);
process.env.JEST_REDIS_PROVIDED = '1';
