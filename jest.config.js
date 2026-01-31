/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/libs', '<rootDir>/apps'],
  testMatch: [
    '**/*.spec.ts',
    '**/*.integration-spec.ts',
    '**/*.performance-spec.ts',
  ],
  // Docker: setup для интеграционных тестов (Testcontainers)
  setupFiles: [
    '<rootDir>/scripts/jest-e2e-docker-setup.js',
    '<rootDir>/scripts/jest-redis-setup.js',
  ],
  globalSetup: '<rootDir>/scripts/jest-redis-global-setup.js',
  globalTeardown: '<rootDir>/scripts/jest-redis-global-teardown.js',
  moduleNameMapper: {
    '^@app/shared$': '<rootDir>/libs/shared/src',
    '^@app/shared/(.*)$': '<rootDir>/libs/shared/src/$1',
  },
  collectCoverageFrom: [
    'libs/shared/src/**/*.ts',
    '!libs/shared/src/**/*.spec.ts',
    '!libs/shared/src/**/*.integration-spec.ts',
    '!libs/shared/src/**/index.ts',
    '!libs/shared/src/database/entities/**',
    '!libs/shared/src/database/migrations/**',
    '!libs/shared/src/database/data-source.ts',
    '!libs/shared/src/database/database.module.ts',
    '!libs/shared/src/config/env-validation.schema.ts',
    '!libs/shared/src/config/shared-config.module.ts',
    '!libs/shared/src/clickhouse/**',
    '!libs/shared/src/redis/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs' } }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  verbose: true,
  forceExit: true,
};
