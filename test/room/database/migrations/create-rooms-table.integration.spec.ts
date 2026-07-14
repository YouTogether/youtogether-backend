import { DataSource, QueryRunner } from 'typeorm';

import { CreateUsersTable1714000000000 } from '../../../../src/database/migrations/1714000000000-CreateUsersTable';
import { CreateRoomsTable1784015715536 } from '../../../../src/database/migrations/1784015715536-CreateRoomsTable';

/**
 * Integration tests for the CreateRoomsTable migration.
 *
 * These tests execute the migration against a real PostgreSQL database and
 * verify the resulting schema matches.
 *
 * The `rooms` and `room_memberships` tables both hold a foreign key to
 * `users`, so the Authentication migration is run first in
 * `beforeAll`, mirroring the dependency order.
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

interface TableInfo {
  table_name: string;
}

interface ConstraintInfo {
  constraint_name: string;
  constraint_type: string;
}

describe('CreateRoomsTable Migration (integration)', () => {
  let dataSource: DataSource;
  let usersMigration: CreateUsersTable1714000000000;
  let roomsMigration: CreateRoomsTable1784015715536;

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

    const queryRunner: QueryRunner = dataSource.createQueryRunner();
    // Idempotent: safe to run even if a previous suite already created `users`.
    await usersMigration.up(queryRunner);
    await roomsMigration.up(queryRunner);
    await queryRunner.release();
  });

  afterAll(async () => {
    // Restore a clean, known state for any suite sharing this test database,
    // following the same defensive pattern as create-users-table.integration.spec.ts.
    const queryRunner: QueryRunner = dataSource.createQueryRunner();
    await roomsMigration.up(queryRunner);
    await queryRunner.release();
    await dataSource.destroy();
  });

  describe('rooms table', () => {
    it('should create the rooms table with all expected columns', async () => {
      const queryRunner: QueryRunner = dataSource.createQueryRunner();

      const rawColumns: unknown = await queryRunner.query(`
          SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
          FROM information_schema.columns
          WHERE table_name = 'rooms'
          ORDER BY ordinal_position;
      `);
      const columns = rawColumns as ColumnInfo[];
      const columnMap = new Map<string, ColumnInfo>(
        columns.map((c) => [c.column_name, c]),
      );

      expect(columnMap.has('id')).toBe(true);
      expect(columnMap.has('name')).toBe(true);
      expect(columnMap.has('description')).toBe(true);
      expect(columnMap.has('owner_id')).toBe(true);
      expect(columnMap.has('is_public')).toBe(true);
      expect(columnMap.has('created_at')).toBe(true);
      expect(columnMap.has('updated_at')).toBe(true);
      expect(columnMap.has('deleted_at')).toBe(true);

      expect(columnMap.get('name')?.character_maximum_length).toBe(100);
      expect(columnMap.get('name')?.is_nullable).toBe('NO');
      expect(columnMap.get('description')?.is_nullable).toBe('YES');
      expect(columnMap.get('owner_id')?.is_nullable).toBe('NO');
      expect(columnMap.get('is_public')?.is_nullable).toBe('NO');
      expect(columnMap.get('deleted_at')?.is_nullable).toBe('YES');

      await queryRunner.release();
    });

    it('should default is_public to true', async () => {
      const queryRunner: QueryRunner = dataSource.createQueryRunner();

      await queryRunner.query(`
          INSERT INTO "users" (email, password_hash, username)
          VALUES ('room-owner-default@test.com', '$2b$12$fakehashvalue', 'room_owner_default');
      `);

      await queryRunner.query(`
          INSERT INTO "rooms" (name, owner_id)
          SELECT 'Default Visibility Room', id
          FROM "users"
          WHERE email = 'room-owner-default@test.com';
      `);

      const rawRooms: unknown = await queryRunner.query(`
          SELECT is_public
          FROM "rooms"
          WHERE name = 'Default Visibility Room';
      `);
      const rooms = rawRooms as { is_public: boolean }[];
      expect(rooms).toHaveLength(1);
      expect(rooms[0].is_public).toBe(true);

      await queryRunner.query(`DELETE
                               FROM "rooms"
                               WHERE name = 'Default Visibility Room';`);
      await queryRunner.query(
        `DELETE
         FROM "users"
         WHERE email = 'room-owner-default@test.com';`,
      );
      await queryRunner.release();
    });

    it('should enforce the foreign key from rooms.owner_id to users.id', async () => {
      const queryRunner: QueryRunner = dataSource.createQueryRunner();

      await expect(
        queryRunner.query(`
            INSERT INTO "rooms" (name, owner_id)
            VALUES ('Orphan Room', gen_random_uuid());
        `),
      ).rejects.toThrow();

      await queryRunner.release();
    });

    it('should index deleted_at for soft-delete filtering', async () => {
      const queryRunner: QueryRunner = dataSource.createQueryRunner();

      const rawIndexes: unknown = await queryRunner.query(`
          SELECT indexname, indexdef
          FROM pg_indexes
          WHERE tablename = 'rooms';
      `);
      const indexes = rawIndexes as IndexInfo[];
      const indexNames = indexes.map((i) => i.indexname);

      expect(indexNames).toContain('IDX_rooms_deleted_at');
      expect(indexNames).toContain('IDX_rooms_owner_id');

      await queryRunner.release();
    });
  });

  describe('room_memberships table', () => {
    it('should create the room_memberships table with all expected columns', async () => {
      const queryRunner: QueryRunner = dataSource.createQueryRunner();

      const rawColumns: unknown = await queryRunner.query(`
          SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
          FROM information_schema.columns
          WHERE table_name = 'room_memberships'
          ORDER BY ordinal_position;
      `);
      const columns = rawColumns as ColumnInfo[];
      const columnMap = new Map<string, ColumnInfo>(
        columns.map((c) => [c.column_name, c]),
      );

      expect(columnMap.has('id')).toBe(true);
      expect(columnMap.has('room_id')).toBe(true);
      expect(columnMap.has('user_id')).toBe(true);
      expect(columnMap.has('joined_at')).toBe(true);
      expect(columnMap.has('left_at')).toBe(true);

      expect(columnMap.get('room_id')?.is_nullable).toBe('NO');
      expect(columnMap.get('user_id')?.is_nullable).toBe('NO');
      expect(columnMap.get('joined_at')?.is_nullable).toBe('NO');
      expect(columnMap.get('left_at')?.is_nullable).toBe('YES');

      await queryRunner.release();
    });

    it('should enforce foreign keys to rooms and users', async () => {
      const queryRunner: QueryRunner = dataSource.createQueryRunner();

      const rawConstraints: unknown = await queryRunner.query(`
          SELECT constraint_name, constraint_type
          FROM information_schema.table_constraints
          WHERE table_name = 'room_memberships'
            AND constraint_type = 'FOREIGN KEY';
      `);
      const constraints = rawConstraints as ConstraintInfo[];

      // Two foreign keys expected: room_id -> rooms.id, user_id -> users.id
      expect(constraints.length).toBeGreaterThanOrEqual(2);

      await queryRunner.release();
    });

    it('should allow a user to rejoin a room after leaving (no hard uniqueness across history)', async () => {
      const queryRunner: QueryRunner = dataSource.createQueryRunner();

      await queryRunner.query(`
          INSERT INTO "users" (email, password_hash, username)
          VALUES ('rejoiner@test.com', '$2b$12$fakehashvalue', 'rejoiner');
      `);
      await queryRunner.query(`
          INSERT INTO "users" (email, password_hash, username)
          VALUES ('room-owner-rejoin@test.com', '$2b$12$fakehashvalue', 'room_owner_rejoin');
      `);
      await queryRunner.query(`
          INSERT INTO "rooms" (name, owner_id)
          SELECT 'Rejoin Room', id
          FROM "users"
          WHERE email = 'room-owner-rejoin@test.com';
      `);

      // First membership, already left (left_at set) — must not block a new join.
      await expect(
        queryRunner.query(`
            INSERT INTO "room_memberships" (room_id, user_id, left_at)
            SELECT r.id, u.id, now()
            FROM "rooms" r,
                 "users" u
            WHERE r.name = 'Rejoin Room'
              AND u.email = 'rejoiner@test.com';
        `),
      ).resolves.not.toThrow();

      await expect(
        queryRunner.query(`
            INSERT INTO "room_memberships" (room_id, user_id)
            SELECT r.id, u.id
            FROM "rooms" r,
                 "users" u
            WHERE r.name = 'Rejoin Room'
              AND u.email = 'rejoiner@test.com';
        `),
      ).resolves.not.toThrow();

      await queryRunner.query(`
          DELETE
          FROM "room_memberships"
          WHERE room_id IN
                (SELECT id FROM "rooms" WHERE name = 'Rejoin Room');
      `);
      await queryRunner.query(`DELETE
                               FROM "rooms"
                               WHERE name = 'Rejoin Room';`);
      await queryRunner.query(`
          DELETE
          FROM "users"
          WHERE email IN ('rejoiner@test.com', 'room-owner-rejoin@test.com');
      `);
      await queryRunner.release();
    });

    it('should reject a second active membership for the same user in the same room (partial unique index)', async () => {
      const queryRunner: QueryRunner = dataSource.createQueryRunner();

      await queryRunner.query(`
          INSERT INTO "users" (email, password_hash, username)
          VALUES ('duplicate-joiner@test.com', '$2b$12$fakehashvalue', 'duplicate_joiner');
      `);
      await queryRunner.query(`
          INSERT INTO "users" (email, password_hash, username)
          VALUES ('room-owner-dup@test.com', '$2b$12$fakehashvalue', 'room_owner_dup');
      `);
      await queryRunner.query(`
          INSERT INTO "rooms" (name, owner_id)
          SELECT 'Duplicate Join Room', id
          FROM "users"
          WHERE email = 'room-owner-dup@test.com';
      `);
      await queryRunner.query(`
          INSERT INTO "room_memberships" (room_id, user_id)
          SELECT r.id, u.id
          FROM "rooms" r,
               "users" u
          WHERE r.name = 'Duplicate Join Room'
            AND u.email = 'duplicate-joiner@test.com';
      `);

      await expect(
        queryRunner.query(`
            INSERT INTO "room_memberships" (room_id, user_id)
            SELECT r.id, u.id
            FROM "rooms" r,
                 "users" u
            WHERE r.name = 'Duplicate Join Room'
              AND u.email = 'duplicate-joiner@test.com';
        `),
      ).rejects.toThrow();

      await queryRunner.query(`
          DELETE
          FROM "room_memberships"
          WHERE room_id IN
                (SELECT id FROM "rooms" WHERE name = 'Duplicate Join Room');
      `);
      await queryRunner.query(`DELETE
                               FROM "rooms"
                               WHERE name = 'Duplicate Join Room';`);
      await queryRunner.query(`
          DELETE
          FROM "users"
          WHERE email IN ('duplicate-joiner@test.com', 'room-owner-dup@test.com');
      `);
      await queryRunner.release();
    });

    it('should expose the partial unique index restricted to active memberships', async () => {
      const queryRunner: QueryRunner = dataSource.createQueryRunner();

      const rawIndexes: unknown = await queryRunner.query(`
          SELECT indexname, indexdef
          FROM pg_indexes
          WHERE tablename = 'room_memberships';
      `);
      const indexes = rawIndexes as IndexInfo[];
      const activeMembershipIndex = indexes.find(
        (i) => i.indexname === 'IDX_room_memberships_active_unique',
      );

      expect(activeMembershipIndex).toBeDefined();
      expect(activeMembershipIndex?.indexdef).toContain('left_at IS NULL');

      await queryRunner.release();
    });
  });

  describe('reversibility', () => {
    it('should revert cleanly (down removes both tables)', async () => {
      const queryRunner: QueryRunner = dataSource.createQueryRunner();

      await roomsMigration.down(queryRunner);

      const rawTables: unknown = await queryRunner.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_name IN ('rooms', 'room_memberships')
            AND table_schema = 'public';
      `);
      const tables = rawTables as TableInfo[];
      expect(tables).toHaveLength(0);

      // Re-run up so afterAll cleanup and any subsequent test file find the tables present.
      await roomsMigration.up(queryRunner);
      await queryRunner.release();
    });
  });
});
