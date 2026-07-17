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
import { LeaveRoomUseCase } from '../../../../src/room/domain/usecases/leave-room.usecase';
import { OwnershipGuard } from '../../../../src/room/presentation/guards/ownership.guard';
import { RoomController } from '../../../../src/room/presentation/controllers/room.controller';

/**
 * Integration tests for POST /rooms/:id/leave.
 *
 * Scenarios covered:
 * - 200 OK for an active, non-owner member leaving.
 * - 403 Forbidden when the room owner attempts to leave directly.
 * - 404 Not Found when the user has no active membership.
 * - 401 Unauthorized with no Authorization header.
 *
 * @competency Integration test harness.
 * @competency Test scenarios and expected results.
 */
const TEST_JWT_SECRET =
  process.env.JWT_SECRET ??
  'e675b2f9affdf3609e857294d44289bf4550c658e214dfab162d9f227e087e507b099101d302aeb480003e94527048dd';

interface ErrorBody {
  statusCode: number;
}

describe('POST /rooms/:id/leave (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let ownerId: string;
  let memberId: string;
  let ownerToken: string;
  let memberToken: string;

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
      VALUES ('leave-owner@integration-test.com', '$2b$12$fakehashvalue', 'leave_owner')
      RETURNING id;
    `);
    ownerId = (rawOwner as { id: string }[])[0].id;

    const rawMember: unknown = await dataSource.query(`
      INSERT INTO "users" (email, password_hash, username)
      VALUES ('leave-member@integration-test.com', '$2b$12$fakehashvalue', 'leave_member')
      RETURNING id;
    `);
    memberId = (rawMember as { id: string }[])[0].id;

    ownerToken = sign({ sub: ownerId, role: 'registered' }, TEST_JWT_SECRET, {
      expiresIn: '15m',
    });
    memberToken = sign({ sub: memberId, role: 'registered' }, TEST_JWT_SECRET, {
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
        'leave-owner@integration-test.com',
        'leave-member@integration-test.com'
      );
    `);
    await app.close();
  });

  async function createRoomAndJoin(name: string): Promise<string> {
    const createResponse = await request(httpServer)
      .post('/rooms')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name });
    const roomId = (createResponse.body as { id: string }).id;

    await request(httpServer)
      .post(`/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    return roomId;
  }

  describe('200 OK', () => {
    it('should set left_at on the active membership and decrement the member count (R-LEA-01)', async () => {
      const roomId = await createRoomAndJoin('Room To Leave');

      await request(httpServer)
        .post(`/rooms/${roomId}/leave`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      const rawMembership: unknown = await dataSource.query(`
        SELECT left_at FROM "room_memberships"
        WHERE room_id = '${roomId}' AND user_id = '${memberId}';
      `);
      const memberships = rawMembership as { left_at: Date | null }[];
      expect(memberships[0].left_at).not.toBeNull();

      const detailResponse = await request(httpServer).get(`/rooms/${roomId}`);
      expect((detailResponse.body as { memberCount: number }).memberCount).toBe(
        1,
      );
    });
  });

  describe('403 Forbidden', () => {
    it('should reject the room owner attempting to leave directly (R-LEA-04)', async () => {
      const roomId = await createRoomAndJoin('Room Owner Cannot Leave');

      const response = await request(httpServer)
        .post(`/rooms/${roomId}/leave`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(403);

      const body = response.body as ErrorBody;
      expect(body.statusCode).toBe(403);
    });
  });

  describe('404 Not Found', () => {
    it('should reject a user with no active membership (R-LEA-03)', async () => {
      const createResponse = await request(httpServer)
        .post('/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Room Never Joined' });
      const roomId = (createResponse.body as { id: string }).id;

      const response = await request(httpServer)
        .post(`/rooms/${roomId}/leave`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(404);

      const body = response.body as ErrorBody;
      expect(body.statusCode).toBe(404);
    });

    it('should reject a second leave attempt for an already-left membership', async () => {
      const roomId = await createRoomAndJoin('Room Double Leave');

      await request(httpServer)
        .post(`/rooms/${roomId}/leave`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      const response = await request(httpServer)
        .post(`/rooms/${roomId}/leave`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(404);

      const body = response.body as ErrorBody;
      expect(body.statusCode).toBe(404);
    });
  });

  describe('401 Unauthorized', () => {
    it('should reject a request with no Authorization header', async () => {
      const roomId = await createRoomAndJoin('Room For Auth Check');

      await request(httpServer).post(`/rooms/${roomId}/leave`).expect(401);
    });
  });
});
