/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/apps'],
  testMatch: ['**/*.e2e-spec.ts'],
  moduleNameMapper: {
    '^@app/shared$': '<rootDir>/libs/shared/src',
    '^@app/shared/(.*)$': '<rootDir>/libs/shared/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs' } }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 120000,
  verbose: true,
  forceExit: true,
};
