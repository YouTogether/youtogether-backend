import { DataSource } from 'typeorm';

import { CreateUsersTable1714000000000 } from '../../../src/database/migrations/1714000000000-CreateUsersTable';

/**
 * Integration tests for the CreateUsersTable migration (B-A01-T1).
 *
 * These tests execute the migration against a real PostgreSQL database
 * and verify the resulting schema matches the data model specification.
 *
 * Prerequisites:
 * - A PostgreSQL test database must be available.
 * - Connection parameters are read from environment variables or the test
 *   configuration defined in the project's ormconfig/test setup.
 *
 * @competency C2.2.2 — Integration test harness for database migrations.
 * @competency C2.3.1 — Test scenario verifying schema correctness.
 */
describe('CreateUsersTable Migration (integration)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_TEST_DATABASE || 'youtogether_test',
      migrations: [],
      synchronize: false,
      logging: false,
    });

    await dataSource.initialize();
  });

  afterAll(async () => {
    // Clean up: revert migration and close connection
    const migration = new CreateUsersTable1714000000000();
    await migration.down(dataSource.createQueryRunner());
    await dataSource.destroy();
  });

  it('should create the users table with all expected columns', async () => {
    const queryRunner = dataSource.createQueryRunner();
    const migration = new CreateUsersTable1714000000000();

    await migration.up(queryRunner);

    type ColumnInfo = {
      column_name: string;
      data_type: string;
      is_nullable: 'YES' | 'NO';
      column_default: string | null;
      character_maximum_length: number | null;
    };

    const columns: ColumnInfo[] = await queryRunner.query<ColumnInfo>(`
        SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position;
    `);

    const columnMap = new Map<string, ColumnInfo>(
      columns.map((c) => [c.column_name, c]),
    );

    // Verify all expected columns exist
    expect(columnMap.has('id')).toBe(true);
    expect(columnMap.has('email')).toBe(true);
    expect(columnMap.has('password_hash')).toBe(true);
    expect(columnMap.has('username')).toBe(true);
    expect(columnMap.has('role')).toBe(true);
    expect(columnMap.has('refresh_token_hash')).toBe(true);
    expect(columnMap.has('created_at')).toBe(true);
    expect(columnMap.has('updated_at')).toBe(true);
    expect(columnMap.has('deleted_at')).toBe(true);

    // Verify UUID primary key
    expect(columnMap.get('id').data_type).toBe('uuid');
    expect(columnMap.get('id').is_nullable).toBe('NO');

    // Verify email constraints
    expect(columnMap.get('email').character_maximum_length).toBe(255);
    expect(columnMap.get('email').is_nullable).toBe('NO');

    // Verify password_hash constraints
    expect(columnMap.get('password_hash').character_maximum_length).toBe(255);
    expect(columnMap.get('password_hash').is_nullable).toBe('NO');

    // Verify username constraints
    expect(columnMap.get('username').character_maximum_length).toBe(50);
    expect(columnMap.get('username').is_nullable).toBe('NO');

    // Verify role uses the user_role enum type (USER-DEFINED in information_schema)
    expect(columnMap.get('role').data_type).toBe('USER-DEFINED');
    expect(columnMap.get('role').is_nullable).toBe('NO');

    // Verify refresh_token_hash is nullable
    expect(columnMap.get('refresh_token_hash').is_nullable).toBe('YES');

    // Verify soft-delete column is nullable
    expect(columnMap.get('deleted_at').is_nullable).toBe('YES');

    await queryRunner.release();
  });

  it('should create the partial unique index on email for active users', async () => {
    type IndexInfo = {
      indexname: string;
      indexdef: string;
    };

    const indexes: IndexInfo[] = await dataSource.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'users'
          AND indexname = 'IDX_users_email_active';
    `);

    expect(indexes).toHaveLength(1);
    expect(indexes[0].indexdef).toContain('UNIQUE');
    expect(indexes[0].indexdef.toLowerCase()).toContain('where');
    expect(indexes[0].indexdef.toLowerCase()).toContain('deleted_at');
  });

  it('should create the index on deleted_at', async () => {
    type IndexInfo = {
      indexname: string;
      indexdef: string;
    };

    const indexes: IndexInfo[] = await dataSource.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'users'
          AND indexname = 'IDX_users_deleted_at';
    `);

    expect(indexes).toHaveLength(1);
  });

  it('should be idempotent (running up twice does not throw)', async () => {
    const queryRunner = dataSource.createQueryRunner();
    const migration = new CreateUsersTable1714000000000();

    // The migration uses IF NOT EXISTS, so a second run should not fail.
    await expect(migration.up(queryRunner)).resolves.not.toThrow();

    await queryRunner.release();
  });

  it('should enforce email uniqueness among active users', async () => {
    const queryRunner = dataSource.createQueryRunner();

    // Insert a first user
    await queryRunner.query(`
        INSERT INTO "users" (email, password_hash, username)
        VALUES ('duplicate@test.com', '$2b$12$fakehashvalue', 'user1');
    `);

    // Attempt to insert a second active user with the same email
    await expect(
      queryRunner.query(`
          INSERT INTO "users" (email, password_hash, username)
          VALUES ('duplicate@test.com', '$2b$12$fakehashvalue', 'user2');
      `),
    ).rejects.toThrow();

    // Clean up
    await queryRunner.query(`DELETE
                             FROM "users"
                             WHERE email = 'duplicate@test.com';`);
    await queryRunner.release();
  });

  it('should allow reuse of email after soft deletion', async () => {
    const queryRunner = dataSource.createQueryRunner();

    // Insert and soft-delete a user
    await queryRunner.query(`
        INSERT INTO "users" (email, password_hash, username, deleted_at)
        VALUES ('reuse@test.com', '$2b$12$fakehashvalue', 'deleted_user', now());
    `);

    // Insert a new active user with the same email — should succeed
    await expect(
      queryRunner.query(`
          INSERT INTO "users" (email, password_hash, username)
          VALUES ('reuse@test.com', '$2b$12$fakehashvalue', 'new_user');
      `),
    ).resolves.not.toThrow();

    // Clean up
    await queryRunner.query(`DELETE
                             FROM "users"
                             WHERE email = 'reuse@test.com';`);
    await queryRunner.release();
  });

  it('should revert cleanly (down removes table and enum)', async () => {
    const queryRunner = dataSource.createQueryRunner();
    const migration = new CreateUsersTable1714000000000();

    await migration.down(queryRunner);

    type TableInfo = { table_name: string };
    type EnumInfo = { typname: string };

    const tables: TableInfo[] = await queryRunner.query<TableInfo>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_name = 'users'
          AND table_schema = 'public';
    `);
    expect(tables).toHaveLength(0);

    const enums: EnumInfo[] = await queryRunner.query<EnumInfo>(`
        SELECT typname
        FROM pg_type
        WHERE typname = 'user_role';
    `);
    expect(enums).toHaveLength(0);

    // Re-run up for other tests or afterAll cleanup
    await migration.up(queryRunner);
    await queryRunner.release();
  });
});
