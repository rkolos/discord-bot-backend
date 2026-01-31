/**
 * Setup for E2E tests: переменные для Testcontainers (Docker).
 * Вызывается из jest.e2e.config.js перед запуском тестов.
 */
// Приоритет IPv4 для DNS (избегаем задержек в контейнерах на некоторых системах)
if (!process.env.NODE_OPTIONS) {
  process.env.NODE_OPTIONS = '--dns-result-order=ipv4first';
} else if (!process.env.NODE_OPTIONS.includes('dns-result-order')) {
  process.env.NODE_OPTIONS += ' --dns-result-order=ipv4first';
}
