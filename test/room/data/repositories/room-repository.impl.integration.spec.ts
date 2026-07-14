import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { CreateUsersTable1714000000000 } from '../../../../src/database/migrations/1714000000000-CreateUsersTable';
import { CreateRoomsTable1784015715536 } from '../../../../src/database/migrations/1784015715536-CreateRoomsTable';
import { UserOrmEntity } from '../../../../src/auth/data/entities/user.orm-entity';
import { RoomOrmEntity } from '../../../../src/room/data/entities/room.orm-entity';
import { RoomMembershipOrmEntity } from '../../../../src/room/data/entities/room-membership.orm-entity';
import { RoomRepositoryImpl } from '../../../../src/room/data/repositories/room-repository.impl';
import { CreateRoomParams } from '../../../../src/room/domain/usecases/create-room.params';

/**
 * Integration tests for RoomRepositoryImpl.findOwnerId.
 *
 * This method has no controller of its own yet (it is a building block
 * for OwnershipGuard, consumed directly by the guard rather than through
 * a use case) so it is verified here against a real database, rather
 * than through a controller integration spec as `create()` was.
 *
 * @competency Integration test harness.
 * @competency Groundwork for R-UPD-05/06, R-DEL-04/05 scenarios.
 */
describe('RoomRepositoryImpl.findOwnerId (integration)', () => {
  let dataSource: DataSource;
  let repository: RoomRepositoryImpl;
  let ownerId: string;
  let activeRoomId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env.test' }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (cs: ConfigService) => ({
            type: 'postgres' as const,
            host: cs.get<string>('DB_HOST', 'localhost'),
            port: cs.get<number>('DB_PORT', 5432),
            username: cs.get<string>('DB_USERNAME', 'postgres'),
            password: cs.get<string>('DB_PASSWORD', 'postgres'),
            database: cs.get<string>('DB_TEST_DATABASE', 'youtogether_test'),
            entities: [UserOrmEntity, RoomOrmEntity, RoomMembershipOrmEntity],
            migrations: [
              CreateUsersTable1714000000000,
              CreateRoomsTable1784015715536,
            ],
            migrationsRun: true,
            synchronize: false,
            logging: false,
          }),
        }),
        TypeOrmModule.forFeature([
          UserOrmEntity,
          RoomOrmEntity,
          RoomMembershipOrmEntity,
        ]),
      ],
      providers: [RoomRepositoryImpl],
    }).compile();

    dataSource = module.get<DataSource>(getDataSourceToken());
    repository = module.get<RoomRepositoryImpl>(RoomRepositoryImpl);

    const rawUser: unknown = await dataSource.query(`
        INSERT INTO "users" (email, password_hash, username)
        VALUES ('ownership-owner@integration-test.com', '$2b$12$fakehashvalue', 'ownership_owner') RETURNING id;
    `);
    ownerId = (rawUser as { id: string }[])[0].id;

    const room = await repository.create(
      new CreateRoomParams({
        ownerId,
        name: 'Ownership Test Room',
        isPublic: true,
      }),
    );
    activeRoomId = room.id;
  });

  afterAll(async () => {
    await dataSource.query(`
        DELETE
        FROM "room_memberships"
        WHERE room_id IN
              (SELECT id FROM "rooms" WHERE owner_id = '${ownerId}');
    `);
    await dataSource.query(`DELETE
                            FROM "rooms"
                            WHERE owner_id = '${ownerId}';`);
    await dataSource.query(
      `DELETE
       FROM "users"
       WHERE email = 'ownership-owner@integration-test.com';`,
    );
    await dataSource.destroy();
  });

  it('should return the owner id for an existing, active room', async () => {
    const result = await repository.findOwnerId(activeRoomId);

    expect(result).toBe(ownerId);
  });

  it('should return null for a non-existent room id', async () => {
    const result = await repository.findOwnerId(
      '00000000-0000-4000-8000-000000000000',
    );

    expect(result).toBeNull();
  });

  it('should return null for a soft-deleted room', async () => {
    await dataSource.query(
      `UPDATE "rooms"
       SET deleted_at = now()
       WHERE id = '${activeRoomId}';`,
    );

    const result = await repository.findOwnerId(activeRoomId);

    expect(result).toBeNull();

    // Restore for any subsequent test relying on this room.
    await dataSource.query(
      `UPDATE "rooms"
       SET deleted_at = NULL
       WHERE id = '${activeRoomId}';`,
    );
  });
});
