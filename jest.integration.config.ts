import type { Config } from 'jest';

/**
 * Jest configuration for integration tests.
 *
 * This configuration is self-contained (no import from jest.config.ts)
 * to avoid module resolution issues in Jest's config loader.
 *
 * Targets only `.integration.spec.ts` files. These tests require a running
 * PostgreSQL instance with connection parameters defined in `.env.test`.
 *
 * Usage:
 *   npm run test:integration
 */
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Target integration tests only
  testRegex: '.*\\.integration\\.spec\\.ts$',
  testPathIgnorePatterns: ['/node_modules/'],

  // Integration tests may take longer due to database operations
  testTimeout: 30000,
};

export default config;
