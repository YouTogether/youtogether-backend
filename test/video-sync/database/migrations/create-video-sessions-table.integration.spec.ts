import { DataSource, QueryRunner } from 'typeorm';

import { CreateUsersTable1714000000000 } from '../../../../src/database/migrations/1714000000000-CreateUsersTable';
import { CreateRoomsTable1784015715536 } from '../../../../src/database/migrations/1784015715536-CreateRoomsTable';
import { CreateVideoSessionsTable1785600000000 } from '../../../../src/database/migrations/1785600000000-CreateVideoSessionsTable';

/**
 * Integration tests for the CreateVideoSessionsTable migration.
 *
 * `video_sessions` holds foreign keys to both `rooms` (room_id) and
 * `users` (added_by), so both prior migrations are run first in
 * `beforeAll`, mirroring `create-rooms-table.integration.spec.ts`'s own
 * dependency ordering on `CreateUsersTable`.
 *
 * @competency Unit/integration test harness preventing regressions.
 * @competency Test scenarios and expected results.
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

interface ConstraintInfo {
  constraint_name: string;
  constraint_type: string;
}

interface TableInfo {
  table_name: string;
}

describe('CreateVideoSessionsTable Migration (integration)', () => {
  let dataSource: DataSource;
  let usersMigration: CreateUsersTable1714000000000;
  let roomsMigration: CreateRoomsTable1784015715536;
  let videoSessionsMigration: CreateVideoSessionsTable1785600000000;

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

    usersMigration = new CreateUsersTable1714000000000();
    roomsMigration = new CreateRoomsTable1784015715536();
    videoSessionsMigration = new CreateVideoSessionsTable1785600000000();

    const queryRunner: QueryRunner = dataSource.createQueryRunner();
    // Idempotent: safe to run even if a previous suite already created
    // `users` and/or `rooms`.
    await usersMigration.up(queryRunner);
    await roomsMigration.up(queryRunner);
    await videoSessionsMigration.down(queryRunner);
    await videoSessionsMigration.up(queryRunner);
    await queryRunner.release();
  });

  afterAll(async () => {
    const queryRunner: QueryRunner = dataSource.createQueryRunner();
    await videoSessionsMigration.up(queryRunner);
    await queryRunner.release();
    await dataSource.destroy();
  });

  it('should create the video_sessions table', async () => {
    const tables = await dataSource.query<TableInfo[]>(
      `SELECT table_name FROM information_schema.tables WHERE table_name = 'video_sessions'`,
    );

    expect(tables).toHaveLength(1);
  });

  it('should define all expected columns with the correct types and nullability', async () => {
    const columns = await dataSource.query<ColumnInfo[]>(
      `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
       FROM information_schema.columns
       WHERE table_name = 'video_sessions'
       ORDER BY column_name`,
    );

    const byName = new Map(columns.map((c) => [c.column_name, c]));

    expect(byName.get('id')?.data_type).toBe('uuid');
    expect(byName.get('id')?.is_nullable).toBe('NO');

    expect(byName.get('room_id')?.data_type).toBe('uuid');
    expect(byName.get('room_id')?.is_nullable).toBe('NO');

    expect(byName.get('youtube_video_id')?.data_type).toBe('character varying');
    expect(byName.get('youtube_video_id')?.character_maximum_length).toBe(20);
    expect(byName.get('youtube_video_id')?.is_nullable).toBe('NO');

    expect(byName.get('title')?.data_type).toBe('character varying');
    expect(byName.get('title')?.character_maximum_length).toBe(255);
    expect(byName.get('title')?.is_nullable).toBe('NO');

    expect(byName.get('thumbnail_url')?.character_maximum_length).toBe(512);
    expect(byName.get('thumbnail_url')?.is_nullable).toBe('YES');

    expect(byName.get('duration_seconds')?.data_type).toBe('integer');
    expect(byName.get('duration_seconds')?.is_nullable).toBe('NO');

    expect(byName.get('added_by')?.data_type).toBe('uuid');
    expect(byName.get('added_by')?.is_nullable).toBe('NO');

    expect(byName.get('created_at')?.data_type).toBe(
      'timestamp with time zone',
    );
    expect(byName.get('created_at')?.is_nullable).toBe('NO');
  });

  it('should enforce a check constraint on the youtube_video_id format', async () => {
    const constraints = await dataSource.query<ConstraintInfo[]>(
      `SELECT constraint_name, constraint_type
       FROM information_schema.table_constraints
       WHERE table_name = 'video_sessions' AND constraint_type = 'CHECK'`,
    );

    expect(
      constraints.some((c) =>
        c.constraint_name.includes('youtube_video_id_format'),
      ),
    ).toBe(true);
  });

  it('should enforce a check constraint requiring a positive duration', async () => {
    const constraints = await dataSource.query<ConstraintInfo[]>(
      `SELECT constraint_name, constraint_type
       FROM information_schema.table_constraints
       WHERE table_name = 'video_sessions' AND constraint_type = 'CHECK'`,
    );

    expect(
      constraints.some((c) =>
        c.constraint_name.includes('duration_seconds_positive'),
      ),
    ).toBe(true);
  });

  it('should create an index on room_id', async () => {
    const indexes = await dataSource.query<IndexInfo[]>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'video_sessions'`,
    );

    expect(
      indexes.some((i) => i.indexname === 'IDX_video_sessions_room_id'),
    ).toBe(true);
  });

  it('should configure foreign keys with cascade rules on room and user deletion', async () => {
    const fks = await dataSource.query<
      { constraint_name: string; delete_rule: string }[]
    >(
      `SELECT con.conname AS constraint_name, con.confdeltype AS delete_rule
       FROM pg_constraint con
       JOIN pg_class rel ON rel.oid = con.conrelid
       JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
       WHERE rel.relname = 'video_sessions'
         AND nsp.nspname = 'public'
         AND con.contype = 'f'`,
    );

    expect(fks.length).toBe(2);
    // confdeltype: 'c' = CASCADE, 'a' = NO ACTION, 'r' = RESTRICT,
    // 'n' = SET NULL, 'd' = SET DEFAULT.
    expect(fks.every((fk) => fk.delete_rule === 'c')).toBe(true);
  });

  it('should be reversible via down()', async () => {
    const queryRunner: QueryRunner = dataSource.createQueryRunner();
    await videoSessionsMigration.down(queryRunner);

    const tables = await dataSource.query<TableInfo[]>(
      `SELECT table_name FROM information_schema.tables WHERE table_name = 'video_sessions'`,
    );
    expect(tables).toHaveLength(0);

    // Restore for any subsequent test in this file/suite run.
    await videoSessionsMigration.up(queryRunner);
    await queryRunner.release();
  });
});
