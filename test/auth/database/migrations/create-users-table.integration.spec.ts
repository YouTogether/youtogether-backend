import { DataSource, QueryRunner } from 'typeorm';

import { CreateUsersTable1714000000000 } from '../../../../src/database/migrations/1714000000000-CreateUsersTable';

/**
 * Integration tests for the CreateUsersTable migration.
 *
 * These tests execute the migration against a real PostgreSQL database
 * and verify the resulting schema matches the data model specification.
 *
 * Prerequisites:
 * - A PostgreSQL test database must be available.
 * - Connection parameters are read from environment variables.
 *
 * @competency Integration test harness for database migrations.
 * @competency Test scenarios verifying schema correctness.
 */

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
}

interface IndexInfo {
  indexname: string;
  indexdef: string;
}

interface TableInfo {
  table_name: string;
}

interface EnumInfo {
  typname: string;
}

describe('CreateUsersTable Migration (integration)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    const connectionOptions =
      databaseUrl !== undefined && databaseUrl !== ''
        ? { url: databaseUrl }
        : {
            host: process.env.DB_HOST ?? 'localhost',
            port: parseInt(process.env.DB_PORT ?? '5432', 10),
            username: process.env.DB_USERNAME ?? 'postgres',
            password: process.env.DB_PASSWORD ?? 'postgres',
            database: process.env.DB_TEST_DATABASE ?? 'youtogether_test',
          };

    dataSource = new DataSource({
      type: 'postgres',
      ...connectionOptions,
      migrations: [],
      synchronize: false,
      logging: false,
    });

    await dataSource.initialize();
  });

  afterAll(async () => {
    const migration = new CreateUsersTable1714000000000();
    const queryRunner: QueryRunner = dataSource.createQueryRunner();
    await migration.down(queryRunner);
    await queryRunner.release();
    await dataSource.destroy();
  });

  it('should create the users table with all expected columns', async () => {
    const queryRunner: QueryRunner = dataSource.createQueryRunner();
    const migration = new CreateUsersTable1714000000000();

    await migration.up(queryRunner);

    // queryRunner.query() returns Promise<any> — cast the result explicitly.
    const rawColumns: unknown = await queryRunner.query(`
        SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position;
    `);

    const columns = rawColumns as ColumnInfo[];
    const columnMap = new Map<string, ColumnInfo>(
      columns.map((c) => [c.column_name, c]),
    );

    // Verify all expected columns are present
    expect(columnMap.has('id')).toBe(true);
    expect(columnMap.has('email')).toBe(true);
    expect(columnMap.has('password_hash')).toBe(true);
    expect(columnMap.has('username')).toBe(true);
    expect(columnMap.has('role')).toBe(true);
    expect(columnMap.has('refresh_token_hash')).toBe(true);
    expect(columnMap.has('created_at')).toBe(true);
    expect(columnMap.has('updated_at')).toBe(true);
    expect(columnMap.has('deleted_at')).toBe(true);

    // Map.get() returns T | undefined — use optional chaining throughout.
    expect(columnMap.get('id')?.data_type).toBe('uuid');
    expect(columnMap.get('id')?.is_nullable).toBe('NO');

    expect(columnMap.get('email')?.character_maximum_length).toBe(255);
    expect(columnMap.get('email')?.is_nullable).toBe('NO');

    expect(columnMap.get('password_hash')?.character_maximum_length).toBe(255);
    expect(columnMap.get('password_hash')?.is_nullable).toBe('NO');

    expect(columnMap.get('username')?.character_maximum_length).toBe(50);
    expect(columnMap.get('username')?.is_nullable).toBe('NO');

    // PostgreSQL reports enum columns as USER-DEFINED in information_schema
    expect(columnMap.get('role')?.data_type).toBe('USER-DEFINED');
    expect(columnMap.get('role')?.is_nullable).toBe('NO');

    expect(columnMap.get('refresh_token_hash')?.is_nullable).toBe('YES');
    expect(columnMap.get('deleted_at')?.is_nullable).toBe('YES');

    await queryRunner.release();
  });

  it('should create the partial unique index on email for active users', async () => {
    const rawIndexes: unknown = await dataSource.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'users'
          AND indexname = 'IDX_users_email_active';
    `);

    const indexes = rawIndexes as IndexInfo[];

    expect(indexes).toHaveLength(1);
    expect(indexes[0].indexdef).toContain('UNIQUE');
    expect(indexes[0].indexdef.toLowerCase()).toContain('where');
    expect(indexes[0].indexdef.toLowerCase()).toContain('deleted_at');
  });

  it('should create the index on deleted_at', async () => {
    const rawIndexes: unknown = await dataSource.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'users'
          AND indexname = 'IDX_users_deleted_at';
    `);

    const indexes = rawIndexes as { indexname: string }[];

    expect(indexes).toHaveLength(1);
  });

  it('should be idempotent (running up twice does not throw)', async () => {
    const queryRunner: QueryRunner = dataSource.createQueryRunner();
    const migration = new CreateUsersTable1714000000000();

    await expect(migration.up(queryRunner)).resolves.not.toThrow();

    await queryRunner.release();
  });

  it('should enforce email uniqueness among active users', async () => {
    const queryRunner: QueryRunner = dataSource.createQueryRunner();

    await queryRunner.query(`
        INSERT INTO "users" (email, password_hash, username)
        VALUES ('duplicate@test.com', '$2b$12$fakehashvalue', 'user1');
    `);

    await expect(
      queryRunner.query(`
          INSERT INTO "users" (email, password_hash, username)
          VALUES ('duplicate@test.com', '$2b$12$fakehashvalue', 'user2');
      `),
    ).rejects.toThrow();

    await queryRunner.query(
      `DELETE
       FROM "users"
       WHERE email = 'duplicate@test.com';`,
    );
    await queryRunner.release();
  });

  it('should allow reuse of email after soft deletion', async () => {
    const queryRunner: QueryRunner = dataSource.createQueryRunner();

    await queryRunner.query(`
        INSERT INTO "users" (email, password_hash, username, deleted_at)
        VALUES ('reuse@test.com', '$2b$12$fakehashvalue', 'deleted_user', now());
    `);

    await expect(
      queryRunner.query(`
          INSERT INTO "users" (email, password_hash, username)
          VALUES ('reuse@test.com', '$2b$12$fakehashvalue', 'new_user');
      `),
    ).resolves.not.toThrow();

    await queryRunner.query(
      `DELETE
       FROM "users"
       WHERE email = 'reuse@test.com';`,
    );
    await queryRunner.release();
  });

  it('should revert cleanly (down removes table and enum)', async () => {
    const queryRunner: QueryRunner = dataSource.createQueryRunner();
    const migration = new CreateUsersTable1714000000000();

    await migration.down(queryRunner);

    const rawTables: unknown = await queryRunner.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_name = 'users'
          AND table_schema = 'public';
    `);
    const tables = rawTables as TableInfo[];
    expect(tables).toHaveLength(0);

    const rawEnums: unknown = await queryRunner.query(`
        SELECT typname
        FROM pg_type
        WHERE typname = 'user_role';
    `);
    const enums = rawEnums as EnumInfo[];
    expect(enums).toHaveLength(0);

    // Re-run up so afterAll cleanup has a table to drop
    await migration.up(queryRunner);
    await queryRunner.release();
  });
});
