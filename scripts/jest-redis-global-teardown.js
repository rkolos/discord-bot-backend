/**
 * Jest globalTeardown: останавливает контейнер Redis, если он был запущен globalSetup, удаляет .jest-redis-env.json.
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ENV_FILE = path.join(__dirname, '..', '.jest-redis-env.json');

function globalTeardown() {
  if (!fs.existsSync(ENV_FILE)) return;

  let data;
  try {
    data = JSON.parse(fs.readFileSync(ENV_FILE, 'utf8'));
  } catch {
    fs.unlinkSync(ENV_FILE);
    return;
  }

  if (data.JEST_REDIS_STARTED_BY_US === true && data.JEST_REDIS_CONTAINER_ID) {
    try {
      execSync(`docker stop ${data.JEST_REDIS_CONTAINER_ID}`, {
        stdio: 'pipe',
        timeout: 10000,
      });
    } catch (err) {
      console.error('jest-redis-global-teardown: docker stop failed:', err.message);
    }
  }

  try {
    fs.unlinkSync(ENV_FILE);
  } catch {
    // ignore
  }
}

module.exports = globalTeardown;
