import { Server } from 'http';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import { sign } from 'jsonwebtoken';
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
import { UpdateRoomUseCase } from '../../../../src/room/domain/usecases/update-room.usecase';
import { DeleteRoomUseCase } from '../../../../src/room/domain/usecases/delete-room.usecase';
import { JoinRoomUseCase } from '../../../../src/room/domain/usecases/join-room.usecase';
import { OwnershipGuard } from '../../../../src/room/presentation/guards/ownership.guard';
import { RoomController } from '../../../../src/room/presentation/controllers/room.controller';
import { LeaveRoomUseCase } from '../../../../src/room/domain/usecases/leave-room.usecase';

/**
 * Integration tests for POST /rooms/:id/join.
 *
 * Scenarios covered:
 * - 200 OK for an authenticated non-member joining an existing room.
 * - 200 OK on rejoin after a prior membership was left (partial unique
 *   index allows a new row once `left_at` is set on the old one).
 * - 409 Conflict for a duplicate active membership.
 * - 404 Not Found for a non-existent or soft-deleted room.
 * - 401 Unauthorized with no Authorization header.
 *
 * @competency Integration test harness.
 * @competency Test scenarios and expected results.
 */
const TEST_JWT_SECRET =
  process.env.JWT_SECRET ??
  'e675b2f9affdf3609e857294d44289bf4550c658e214dfab162d9f227e087e507b099101d302aeb480003e94527048dd';

interface RoomBody {
  id: string;
  memberCount: number;
}

interface ErrorBody {
  statusCode: number;
}

describe('POST /rooms/:id/join (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let ownerId: string;
  let joinerId: string;
  let ownerToken: string;
  let joinerToken: string;

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
        JoinRoomUseCase,
        LeaveRoomUseCase,
        OwnershipGuard,
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

    const rawOwner: unknown = await dataSource.query(`
      INSERT INTO "users" (email, password_hash, username)
      VALUES ('join-owner@integration-test.com', '$2b$12$fakehashvalue', 'join_owner')
      RETURNING id;
    `);
    ownerId = (rawOwner as { id: string }[])[0].id;

    const rawJoiner: unknown = await dataSource.query(`
      INSERT INTO "users" (email, password_hash, username)
      VALUES ('join-joiner@integration-test.com', '$2b$12$fakehashvalue', 'join_joiner')
      RETURNING id;
    `);
    joinerId = (rawJoiner as { id: string }[])[0].id;

    ownerToken = sign({ sub: ownerId, role: 'registered' }, TEST_JWT_SECRET, {
      expiresIn: '15m',
    });
    joinerToken = sign({ sub: joinerId, role: 'registered' }, TEST_JWT_SECRET, {
      expiresIn: '15m',
    });
  });

  afterAll(async () => {
    await dataSource.query(`
      DELETE FROM "room_memberships" WHERE room_id IN
        (SELECT id FROM "rooms" WHERE owner_id = '${ownerId}');
    `);
    await dataSource.query(
      `DELETE FROM "rooms" WHERE owner_id = '${ownerId}';`,
    );
    await dataSource.query(`
      DELETE FROM "users" WHERE email IN (
        'join-owner@integration-test.com',
        'join-joiner@integration-test.com'
      );
    `);
    await app.close();
  });

  async function createRoom(name: string): Promise<string> {
    const response = await request(httpServer)
      .post('/rooms')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name });

    return (response.body as { id: string }).id;
  }

  describe('200 OK', () => {
    it('should create an active membership and increment the member count (R-JOI-01)', async () => {
      const roomId = await createRoom('Room To Join');

      const response = await request(httpServer)
        .post(`/rooms/${roomId}/join`)
        .set('Authorization', `Bearer ${joinerToken}`)
        .expect(200);

      const body = response.body as RoomBody;
      expect(body.memberCount).toBe(2); // owner (auto-joined) + joiner

      const rawMembership: unknown = await dataSource.query(`
        SELECT left_at FROM "room_memberships"
        WHERE room_id = '${roomId}' AND user_id = '${joinerId}';
      `);
      const memberships = rawMembership as { left_at: Date | null }[];
      expect(memberships).toHaveLength(1);
      expect(memberships[0].left_at).toBeNull();
    });

    it('should allow rejoining after a prior membership was left (partial unique index)', async () => {
      const roomId = await createRoom('Room To Rejoin');

      await dataSource.query(`
        INSERT INTO "room_memberships" (room_id, user_id, left_at)
        VALUES ('${roomId}', '${joinerId}', now());
      `);

      const response = await request(httpServer)
        .post(`/rooms/${roomId}/join`)
        .set('Authorization', `Bearer ${joinerToken}`)
        .expect(200);

      const body = response.body as RoomBody;
      expect(body.memberCount).toBe(2);

      const rawMemberships: unknown = await dataSource.query(`
        SELECT left_at FROM "room_memberships"
        WHERE room_id = '${roomId}' AND user_id = '${joinerId}'
        ORDER BY joined_at;
      `);
      const memberships = rawMemberships as { left_at: Date | null }[];
      expect(memberships).toHaveLength(2);
      expect(memberships[1].left_at).toBeNull();
    });
  });

  describe('409 Conflict', () => {
    it('should reject a duplicate active membership (R-JOI-03)', async () => {
      const roomId = await createRoom('Room For Duplicate Join');

      await request(httpServer)
        .post(`/rooms/${roomId}/join`)
        .set('Authorization', `Bearer ${joinerToken}`)
        .expect(200);

      const response = await request(httpServer)
        .post(`/rooms/${roomId}/join`)
        .set('Authorization', `Bearer ${joinerToken}`)
        .expect(409);

      const body = response.body as ErrorBody;
      expect(body.statusCode).toBe(409);
    });
  });

  describe('404 Not Found', () => {
    it('should return 404 for a non-existent room (R-JOI-04)', async () => {
      const response = await request(httpServer)
        .post('/rooms/00000000-0000-4000-8000-000000000000/join')
        .set('Authorization', `Bearer ${joinerToken}`)
        .expect(404);

      const body = response.body as ErrorBody;
      expect(body.statusCode).toBe(404);
    });

    it('should return 404 for a soft-deleted room', async () => {
      const roomId = await createRoom('Room To Delete Then Join');

      await request(httpServer)
        .delete(`/rooms/${roomId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const response = await request(httpServer)
        .post(`/rooms/${roomId}/join`)
        .set('Authorization', `Bearer ${joinerToken}`)
        .expect(404);

      const body = response.body as ErrorBody;
      expect(body.statusCode).toBe(404);
    });
  });

  describe('401 Unauthorized', () => {
    it('should reject a request with no Authorization header (R-JOI-05)', async () => {
      const roomId = await createRoom('Room For Auth Check');

      await request(httpServer).post(`/rooms/${roomId}/join`).expect(401);
    });
  });
});
