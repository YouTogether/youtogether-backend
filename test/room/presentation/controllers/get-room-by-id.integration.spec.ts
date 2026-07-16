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
import { GetRoomByIdUseCase } from '../../../../src/room/domain/usecases/get-room-by-id.usecase';
import { RoomController } from '../../../../src/room/presentation/controllers/room.controller';
import { UpdateRoomUseCase } from '../../../../src/room/domain/usecases/update-room.usecase';
import { DeleteRoomUseCase } from '../../../../src/room/domain/usecases/delete-room.usecase';

/**
 * Integration tests for GET /rooms/:id.
 *
 * Scenarios covered:
 * - 200 OK for an existing, active room, with an accurate member count.
 * - 404 Not Found for a non-existent room id.
 * - 404 Not Found for a soft-deleted room.
 *
 * No `currentVideoSession` field is asserted here: the `video_sessions`
 * table does not exist yet (it is introduced in Sprint 3, B-V01-T1 —
 * see the response documented in this task's delivery notes). This
 * endpoint deliberately returns room + member count only for now.
 *
 * @competency Integration test harness.
 * @competency Test scenarios and expected results.
 */
const TEST_JWT_SECRET =
  process.env.JWT_SECRET ??
  'e675b2f9affdf3609e857294d44289bf4550c658e214dfab162d9f227e087e507b099101d302aeb480003e94527048dd';

interface RoomDetailBody {
  id: string;
  name: string;
  memberCount: number;
}

interface ErrorBody {
  statusCode: number;
  message: string;
}

describe('GET /rooms/:id (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let ownerId: string;
  let activeRoomId: string;
  let deletedRoomId: string;

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
        GetRoomByIdUseCase,
        UpdateRoomUseCase,
        DeleteRoomUseCase,
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
        VALUES ('detail-owner@integration-test.com', '$2b$12$fakehashvalue', 'detail_owner') RETURNING id;
    `);
    ownerId = (rawUser as { id: string }[])[0].id;

    const rawMember: unknown = await dataSource.query(`
        INSERT INTO "users" (email, password_hash, username)
        VALUES ('detail-member@integration-test.com', '$2b$12$fakehashvalue', 'detail_member') RETURNING id;
    `);
    const memberId = (rawMember as { id: string }[])[0].id;

    const rawActiveRoom: unknown = await dataSource.query(`
        INSERT INTO "rooms" (name, owner_id, is_public)
        VALUES ('Detail Active Room', '${ownerId}', true) RETURNING id;
    `);
    activeRoomId = (rawActiveRoom as { id: string }[])[0].id;

    await dataSource.query(`
        INSERT INTO "room_memberships" (room_id, user_id)
        VALUES ('${activeRoomId}', '${ownerId}'),
               ('${activeRoomId}', '${memberId}');
    `);

    const rawDeletedRoom: unknown = await dataSource.query(`
        INSERT INTO "rooms" (name, owner_id, is_public, deleted_at)
        VALUES ('Detail Deleted Room', '${ownerId}', true, now()) RETURNING id;
    `);
    deletedRoomId = (rawDeletedRoom as { id: string }[])[0].id;
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
                        'detail-owner@integration-test.com',
                        'detail-member@integration-test.com'
            );
    `);
    await app.close();
  });

  describe('200 OK', () => {
    it('should return the room detail with an accurate member count (R-DET-01)', async () => {
      const response = await request(httpServer)
        .get(`/rooms/${activeRoomId}`)
        .expect(200);

      const body = response.body as RoomDetailBody;
      expect(body.id).toBe(activeRoomId);
      expect(body.name).toBe('Detail Active Room');
      expect(body.memberCount).toBe(2);
    });
  });

  describe('404 Not Found', () => {
    it('should return 404 for a non-existent room id (R-DET-02)', async () => {
      const response = await request(httpServer)
        .get('/rooms/00000000-0000-4000-8000-000000000000')
        .expect(404);

      const body = response.body as ErrorBody;
      expect(body.statusCode).toBe(404);
    });

    it('should return 404 for a soft-deleted room (R-DET-03)', async () => {
      const response = await request(httpServer)
        .get(`/rooms/${deletedRoomId}`)
        .expect(404);

      const body = response.body as ErrorBody;
      expect(body.statusCode).toBe(404);
    });
  });
});
