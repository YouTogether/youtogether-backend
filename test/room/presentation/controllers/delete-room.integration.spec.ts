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
import { OwnershipGuard } from '../../../../src/room/presentation/guards/ownership.guard';
import { RoomController } from '../../../../src/room/presentation/controllers/room.controller';
import { JoinRoomUseCase } from '../../../../src/room/domain/usecases/join-room.usecase';

/**
 * Integration tests for DELETE /rooms/:id.
 *
 * Exercises the real guard chain (`JwtAuthGuard`, `OwnershipGuard`)
 * against a fully bootstrapped application, mirroring
 * `update-room.integration.spec.ts`.
 *
 * Scenarios covered:
 * - 200 OK for the owner; the room disappears from the public listing;
 *   its memberships are preserved (soft delete, not a hard delete).
 * - 403 Forbidden for a non-owner.
 * - 404 Not Found for a non-existent room, and for a second delete on an
 *   already-deleted room — both rejected by {@link OwnershipGuard} itself
 *   (whose `findOwnerId` lookup excludes soft-deleted rows), never
 *   reaching {@link DeleteRoomUseCase} at all.
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

describe('DELETE /rooms/:id (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let ownerId: string;
  let nonOwnerId: string;
  let ownerToken: string;
  let nonOwnerToken: string;

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
        VALUES ('delete-owner@integration-test.com', '$2b$12$fakehashvalue', 'delete_owner') RETURNING id;
    `);
    ownerId = (rawOwner as { id: string }[])[0].id;

    const rawNonOwner: unknown = await dataSource.query(`
        INSERT INTO "users" (email, password_hash, username)
        VALUES ('delete-non-owner@integration-test.com', '$2b$12$fakehashvalue', 'delete_non_owner') RETURNING id;
    `);
    nonOwnerId = (rawNonOwner as { id: string }[])[0].id;

    ownerToken = sign({ sub: ownerId, role: 'registered' }, TEST_JWT_SECRET, {
      expiresIn: '15m',
    });
    nonOwnerToken = sign(
      { sub: nonOwnerId, role: 'registered' },
      TEST_JWT_SECRET,
      { expiresIn: '15m' },
    );
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
                        'delete-owner@integration-test.com',
                        'delete-non-owner@integration-test.com'
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
    it('should soft-delete the room for the owner and remove it from the public listing (R-DEL-01)', async () => {
      const roomId = await createRoom('Room To Delete');

      await request(httpServer)
        .delete(`/rooms/${roomId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const rawRoom: unknown = await dataSource.query(`
          SELECT deleted_at
          FROM "rooms"
          WHERE id = '${roomId}';
      `);
      const rooms = rawRoom as { deleted_at: Date | null }[];
      expect(rooms[0].deleted_at).not.toBeNull();

      const listingResponse = await request(httpServer).get('/rooms');
      const listedIds = (listingResponse.body as { id: string }[]).map(
        (room) => room.id,
      );
      expect(listedIds).not.toContain(roomId);
    });

    it('should preserve room memberships after deletion for audit purposes (R-DEL-03)', async () => {
      const roomId = await createRoom('Room With Membership History');

      await request(httpServer)
        .delete(`/rooms/${roomId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const rawMemberships: unknown = await dataSource.query(`
          SELECT id
          FROM "room_memberships"
          WHERE room_id = '${roomId}';
      `);
      expect((rawMemberships as { id: string }[]).length).toBeGreaterThan(0);
    });
  });

  describe('403 Forbidden', () => {
    it('should reject a deletion attempt from a non-owner (R-DEL-04)', async () => {
      const roomId = await createRoom('Room Owned By Someone Else');

      const response = await request(httpServer)
        .delete(`/rooms/${roomId}`)
        .set('Authorization', `Bearer ${nonOwnerToken}`)
        .expect(403);

      const body = response.body as ErrorBody;
      expect(body.statusCode).toBe(403);
    });
  });

  describe('404 Not Found', () => {
    it('should return 404 for a non-existent room', async () => {
      const response = await request(httpServer)
        .delete('/rooms/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);

      const body = response.body as ErrorBody;
      expect(body.statusCode).toBe(404);
    });

    it('should return 404 on a second delete of an already-deleted room (R-DEL-05)', async () => {
      const roomId = await createRoom('Room To Delete Twice');

      await request(httpServer)
        .delete(`/rooms/${roomId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const response = await request(httpServer)
        .delete(`/rooms/${roomId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);

      const body = response.body as ErrorBody;
      expect(body.statusCode).toBe(404);
    });
  });

  describe('401 Unauthorized', () => {
    it('should reject a request with no Authorization header', async () => {
      const roomId = await createRoom('Room For Auth Check');

      await request(httpServer).delete(`/rooms/${roomId}`).expect(401);
    });
  });
});
