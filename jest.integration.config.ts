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
  // Force fully serial execution: every *.integration.spec.ts file opens
  // its own NestJS application and TypeORM DataSource against the SAME
  // shared physical test database, and runs DB migrations on init. Running
  // files in parallel workers allows two DataSource.initialize() calls to
  // race on non-atomic "IF NOT EXISTS" DDL guards (CREATE TYPE, CREATE
  // TABLE) inside the migration, producing intermittent
  // "duplicate key value violates unique constraint pg_type_typname_nsp_index"
  // failures on a fresh database, plus secondary symptoms (unexpected 401s)
  // from connection-pool reuse after a failed migration transaction.
  //
  // With maxWorkers: 1, each file's full lifecycle (beforeAll -> tests ->
  // afterAll) completes before the next file starts, so only one
  // DataSource.initialize() / migrationsRun call is ever in flight
  // process-wide. This is complementary to (not a replacement for) removing
  // dropSchema:true from individual spec files — both address the same
  // root cause of multiple independent processes/files mutating a shared
  // database without coordination.
  maxWorkers: 1,
};

export default config;
