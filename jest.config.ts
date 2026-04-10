import type { Config } from 'jest';

/**
 * Jest configuration for the youtogether-backend project.
 *
 * Two test suites are defined:
 * - `unit`: fast tests with no external dependencies (no database, no network).
 * - `integration`: tests requiring a running PostgreSQL instance.
 *
 * Environment variables are loaded from `.env.test` via the setup file
 * before any test suite runs.
 *
 * Usage:
 *   npm run test              # runs unit tests only
 *   npm run test:integration  # runs integration tests only
 *   npm run test:all          # runs both suites
 */
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',

  // Transform TypeScript files via ts-jest
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },

  // Load .env.test before all suites
  setupFiles: ['<rootDir>/test/setup-env.ts'],

  // Module path aliases matching tsconfig paths (if any)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Default: run unit tests only (files ending in .spec.ts, excluding .integration.spec.ts)
  testRegex: '.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['\\.integration\\.spec\\.ts$', '/node_modules/'],

  // Coverage configuration
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.module.ts', '!src/main.ts'],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov'],
};

export default config;
