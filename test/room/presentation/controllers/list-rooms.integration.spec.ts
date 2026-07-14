import { Server } from 'http';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { CreateUsersTable1714000000000 } from '../../../../src/database/migrations/1714000000000-CreateUsersTable';
import { CreateRoomsTable1784015715536 } from '../../../../src/database/migrations/1784015715536-CreateRoomsTable';
import { UserOrmEntity } from '../../../../src/auth/data/entities/user.orm-entity';
import { JwtStrategy } from '../../../../src/auth/presentation/strategies/jwt.strategy';
import { RoomOrmEntity } from '../../../../src/room/data/entities/room.orm-entity';
import { RoomMembershipOrmEntity } from '../../../../src/room/data/entities/room-membership.orm-entity';
import { RoomRepositoryImpl } from '../../../../src/room/data/repositories/room-repository.impl';
import { IRoomRepository } from '../../../../src/room/domain/repositories/room-repository.interface';
import { CreateRoomUseCase } from '../../../../src/room/domain/usecases/create-room.usecase';
import { GetPublicRoomsUseCase } from '../../../../src/room/domain/usecases/get-public-rooms.usecase';
import { RoomController } from '../../../../src/room/presentation/controllers/room.controller';

/**
 * Integration tests for GET /rooms (B-R02-T1).
 *
 * Seeds a mix of public/private and active/soft-deleted rooms, with
 * memberships in both active and left states, then verifies the listing
 * query filters and computes member counts correctly.
 *
 * Scenarios covered (see cahier de recette §3, R-LST-01 through R-LST-07):
 * - 200 OK, no Authorization header required.
 * - Only public, non-deleted rooms returned.
 * - Active member count excludes memberships with left_at set.
 *
 * @competency C2.2.2 — Integration test harness.
 * @competency C2.3.1 — Test scenarios and expected results (cahier de recette).
 */
const TEST_JWT_SECRET =
  process.env.JWT_SECRET ??
  'e675b2f9affdf3609e857294d44289bf4550c658e214dfab162d9f227e087e507b099101d302aeb480003e94527048dd';

interface RoomListItemBody {
  id: string;
  name: string;
  isPublic: boolean;
  memberCount: number;
}

describe('GET /rooms (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let ownerId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
          ignoreEnvFile: process.env.DATABASE_URL !== undefined,
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            const databaseUrl = process.env.DATABASE_URL;
            const connection =
              databaseUrl !== undefined && databaseUrl !== ''
                ? { url: databaseUrl }
                : {
                    host: configService.get<string>('DB_HOST', 'localhost'),
                    port: configService.get<number>('DB_PORT', 5432),
                    username: configService.get<string>(
                      'DB_USERNAME',
                      'postgres',
                    ),
                    password: configService.get<string>(
                      'DB_PASSWORD',
                      'postgres',
                    ),
                    database: configService.get<string>(
                      'DB_TEST_DATABASE',
                      'youtogether_test',
                    ),
                  };

            return {
              type: 'postgres' as const,
              ...connection,
              entities: [UserOrmEntity, RoomOrmEntity, RoomMembershipOrmEntity],
              migrations: [
                CreateUsersTable1714000000000,
                CreateRoomsTable1784015715536,
              ],
              migrationsRun: true,
              synchronize: false,
              logging: ['error' as const],
            };
          },
        }),
        TypeOrmModule.forFeature([
          UserOrmEntity,
          RoomOrmEntity,
          RoomMembershipOrmEntity,
        ]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
          useFactory: () => ({
            secret: TEST_JWT_SECRET,
            signOptions: { expiresIn: '15m' },
          }),
        }),
      ],
      controllers: [RoomController],
      providers: [
        CreateRoomUseCase,
        GetPublicRoomsUseCase,
        JwtStrategy,
        { provide: IRoomRepository, useClass: RoomRepositoryImpl },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    httpServer = app.getHttpServer() as Server;
    dataSource = module.get<DataSource>(getDataSourceToken());

    const rawUser: unknown = await dataSource.query(`
        INSERT INTO "users" (email, password_hash, username)
        VALUES ('listing-owner@integration-test.com', '$2b$12$fakehashvalue', 'listing_owner') RETURNING id;
    `);
    ownerId = (rawUser as { id: string }[])[0].id;

    const rawMember: unknown = await dataSource.query(`
        INSERT INTO "users" (email, password_hash, username)
        VALUES ('listing-member@integration-test.com', '$2b$12$fakehashvalue', 'listing_member') RETURNING id;
    `);
    const memberId = (rawMember as { id: string }[])[0].id;

    const rawLeftMember: unknown = await dataSource.query(`
        INSERT INTO "users" (email, password_hash, username)
        VALUES ('listing-left-member@integration-test.com', '$2b$12$fakehashvalue', 'listing_left_member') RETURNING id;
    `);
    const leftMemberId = (rawLeftMember as { id: string }[])[0].id;

    // Public, active room with 3 active members (owner + 2) and 1 who left.
    const rawPublicRoom: unknown = await dataSource.query(`
        INSERT INTO "rooms" (name, owner_id, is_public)
        VALUES ('Public Active Room', '${ownerId}', true) RETURNING id;
    `);
    const publicRoomId = (rawPublicRoom as { id: string }[])[0].id;

    await dataSource.query(`
        INSERT INTO "room_memberships" (room_id, user_id)
        VALUES ('${publicRoomId}', '${ownerId}'),
               ('${publicRoomId}', '${memberId}');
    `);
    await dataSource.query(`
        INSERT INTO "room_memberships" (room_id, user_id, left_at)
        VALUES ('${publicRoomId}', '${leftMemberId}', now());
    `);

    // Private room — must be excluded from the listing.
    await dataSource.query(`
        INSERT INTO "rooms" (name, owner_id, is_public)
        VALUES ('Private Room', '${ownerId}', false);
    `);

    // Public but soft-deleted room — must be excluded from the listing.
    await dataSource.query(`
        INSERT INTO "rooms" (name, owner_id, is_public, deleted_at)
        VALUES ('Deleted Public Room', '${ownerId}', true, now());
    `);
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
    await dataSource.query(`
        DELETE
        FROM "users"
        WHERE email IN (
                        'listing-owner@integration-test.com',
                        'listing-member@integration-test.com',
                        'listing-left-member@integration-test.com'
            );
    `);
    await app.close();
  });

  it('should return 200 with no Authorization header (R-LST-01)', async () => {
    await request(httpServer).get('/rooms').expect(200);
  });

  it('should return only public, non-deleted rooms (R-LST-05)', async () => {
    const response = await request(httpServer).get('/rooms').expect(200);
    const body = response.body as RoomListItemBody[];

    const names = body.map((room) => room.name);
    expect(names).toContain('Public Active Room');
    expect(names).not.toContain('Private Room');
    expect(names).not.toContain('Deleted Public Room');
  });

  it('should compute the active member count, excluding members who left (R-LST-02)', async () => {
    const response = await request(httpServer).get('/rooms').expect(200);
    const body = response.body as RoomListItemBody[];

    const publicRoom = body.find((room) => room.name === 'Public Active Room');
    expect(publicRoom).toBeDefined();
    expect(publicRoom?.memberCount).toBe(2);
  });
});
