import { config } from 'dotenv';
import { resolve } from 'path';

/**
 * Jest setup file — loads environment variables from `.env.test`
 * before any test suite executes.
 *
 * This file is referenced in `jest.config.ts` via the `setupFiles` option.
 * It runs once per Jest worker process, ensuring all test files have access
 * to the database connection parameters and other configuration values.
 *
 * Resolution order:
 * 1. `.env.test` at the project root (committed, contains safe defaults).
 * 2. `.env.test.local` at the project root (gitignored, for developer overrides).
 * 3. Existing environment variables take precedence (CI/CD pipelines).
 */
config({ path: resolve(__dirname, '..', '.env.test') });
config({ path: resolve(__dirname, '..', '.env.test.local'), override: true });
