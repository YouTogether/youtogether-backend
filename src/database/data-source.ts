import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';

import { UserOrmEntity } from '../auth/data/entities/user.orm-entity';
import { CreateUsersTable1714000000000 } from './migrations/1714000000000-CreateUsersTable';

/**
 * Reads a required environment variable, throwing a descriptive error if it
 * is undefined or empty.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Provide either DATABASE_URL or the discrete DB_* variables ` +
        `(DB_USERNAME, DB_PASSWORD, DB_DATABASE).`,
    );
  }
  return value;
}

/**
 * Builds the connection portion of the DataSource options.
 *
 * Two configuration styles are supported, in order of precedence:
 *
 * 1. `DATABASE_URL` — a single PostgreSQL connection string, e.g.
 *    `postgresql://user:password@host:5432/database`. This is the style used
 *    by the CI pipeline and most managed hosting providers (Heroku, Render…).
 *
 * 2. Discrete `DB_*` variables — DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD,
 *    DB_DATABASE. Convenient for local development with a `.env` file.
 *
 * If `DATABASE_URL` is present it takes precedence and the discrete variables
 * are ignored. If neither style is fully provided, an explicit error is raised
 * rather than allowing a silent fallback that would later fail authentication.
 */
function buildConnectionOptions(): Pick<DataSourceOptions, 'type'> &
  (
    | { url: string }
    | {
        host: string;
        port: number;
        username: string;
        password: string;
        database: string;
      }
  ) {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl !== undefined && databaseUrl !== '') {
    return { type: 'postgres', url: databaseUrl };
  }

  return {
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: requireEnv('DB_USERNAME'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_DATABASE'),
  };
}

/**
 * Standalone TypeORM DataSource used by the TypeORM CLI.
 *
 * Consumed by npm scripts that wrap the TypeORM CLI:
 * - `npm run migration:run` — applies pending migrations.
 * - `npm run migration:revert` — rolls back the most recent migration.
 * - `npm run migration:generate` — scaffolds a new migration from entity diffs.
 *
 * Independent of the NestJS dependency-injection container so it can be
 * invoked from CI pipelines, Docker entrypoints, or local scripts without
 * bootstrapping the application.
 *
 * Supports both DATABASE_URL (CI / managed hosting) and discrete DB_*
 * variables (local development). See {@link buildConnectionOptions}.
 *
 * @see Sprint 1 Planning — B-A01-T1 (initial migration)
 * @competency C2.2.3 — Reproducible, environment-agnostic schema deployments
 */
const AppDataSource = new DataSource({
  ...buildConnectionOptions(),
  entities: [UserOrmEntity],
  migrations: [CreateUsersTable1714000000000],
  synchronize: false,
  logging: false,
} as DataSourceOptions);

export default AppDataSource;
