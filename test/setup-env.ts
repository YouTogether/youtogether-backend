import { config } from 'dotenv';
import { resolve } from 'path';

/**
 * Jest setup file — normalizes environment variables before any test suite.
 *
 * Referenced by `jest.config.ts` and `jest.integration.config.ts` via the
 * `setupFiles` option. Runs once per Jest worker, before any test or
 * application module is imported.
 *
 * Precedence (highest first):
 * 1. A CI-provided DATABASE_URL. When present, it is authoritative: no .env
 *    file is loaded, and any discrete DB_* variables are removed so they cannot
 *    reconstruct a conflicting connection downstream. This prevents the
 *    committed `.env.test` (local postgres/postgres credentials) from
 *    overriding the CI connection — the root cause of
 *    `password authentication failed for user "postgres"` in CI.
 * 2. Locally (no DATABASE_URL): `.env.test` then `.env.test.local` are loaded,
 *    the latter overriding the former for developer-specific values.
 */
const ciDatabaseUrl = process.env.DATABASE_URL;
const isCi = ciDatabaseUrl !== undefined && ciDatabaseUrl !== '';

if (isCi) {
  // CI is authoritative — DATABASE_URL is the single source of truth.
  // Remove discrete DB_* variables that any earlier load may have set.
  delete process.env.DB_HOST;
  delete process.env.DB_PORT;
  delete process.env.DB_USERNAME;
  delete process.env.DB_PASSWORD;
  delete process.env.DB_DATABASE;
  delete process.env.DB_TEST_DATABASE;
} else {
  // Local development: load committed defaults then developer overrides.
  config({ path: resolve(__dirname, '..', '.env.test') });
  config({
    path: resolve(__dirname, '..', '.env.test.local'),
    override: true,
  });
}
