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
import { RoomController } from '../../../../src/room/presentation/controllers/room.controller';

/**
 * Integration tests for POST /rooms.
 *
 * Boots a minimal NestJS application with a real PostgreSQL test database,
 * seeding a real `users` row (required by the `rooms.owner_id` foreign
 * key) and signing a JWT directly rather than exercising the full
 * register/login flow, mirroring `me.integration.spec.ts`.
 *
 * Scenarios covered:
 * - 201 Created: valid payload, room persisted, owner auto-joined as a member.
 * - 201 Created: is_public defaults to true when omitted.
 * - 400 Bad Request: missing name, name exceeding 100 characters.
 * - 401 Unauthorized: no Authorization header.
 *
 * @competency Integration test harness.
 * @competency Test scenarios and expected results.
 */
const TEST_JWT_SECRET =
  process.env.JWT_SECRET ??
  'e675b2f9affdf3609e857294d44289bf4550c658e214dfab162d9f227e087e507b099101d302aeb480003e94527048dd';

interface RoomSuccessBody {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  isPublic: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
}

describe('POST /rooms (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let ownerId: string;
  let accessToken: string;

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
              // Idempotent migrations (CREATE TABLE IF NOT EXISTS): safe to
              // run alongside other *.integration.spec.ts files sharing the
              // same physical test database. See create-users-table spec
              // for the full rationale.
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

    // Seed a real user row directly (bypasses the Authentication bounded
    // context entirely — this suite tests Room, not Auth) to satisfy the
    // rooms.owner_id foreign key.
    const rawUser: unknown = await dataSource.query(`
        INSERT INTO "users" (email, password_hash, username)
        VALUES ('room-creator@integration-test.com', '$2b$12$fakehashvalue', 'room_creator') RETURNING id;
    `);
    ownerId = (rawUser as { id: string }[])[0].id;

    accessToken = sign({ sub: ownerId, role: 'registered' }, TEST_JWT_SECRET, {
      expiresIn: '15m',
    });
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
       WHERE email = 'room-creator@integration-test.com';`,
    );
    await app.close();
  });

  // ─── 201 Created ──────────────────────────────────────────────────

  describe('201 Created', () => {
    it('should create a room and auto-join the owner as a member (R-CRE-01)', async () => {
      const response = await request(httpServer)
        .post('/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Friday Movie Night', description: 'Weekly watch party' })
        .expect(201);

      const body = response.body as RoomSuccessBody;

      expect(body.name).toBe('Friday Movie Night');
      expect(body.description).toBe('Weekly watch party');
      expect(body.ownerId).toBe(ownerId);
      expect(body.isPublic).toBe(true);
      expect(body.memberCount).toBe(1);
      expect(body.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );

      const rawMembership: unknown = await dataSource.query(`
          SELECT room_id, user_id, left_at
          FROM "room_memberships"
          WHERE room_id = '${body.id}'
            AND user_id = '${ownerId}';
      `);
      const memberships = rawMembership as { left_at: Date | null }[];
      expect(memberships).toHaveLength(1);
      expect(memberships[0].left_at).toBeNull();
    });

    it('should default is_public to true when omitted (R-CRE-05)', async () => {
      const response = await request(httpServer)
        .post('/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Default Visibility Room' })
        .expect(201);

      const body = response.body as RoomSuccessBody;
      expect(body.isPublic).toBe(true);
    });
  });

  // ─── 400 Bad Request ──────────────────────────────────────────────

  describe('400 Bad Request', () => {
    it('should reject a missing name (R-CRE-03)', async () => {
      const response = await request(httpServer)
        .post('/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ description: 'no name here' })
        .expect(400);

      const body = response.body as ErrorBody;
      expect(body.statusCode).toBe(400);
    });

    it('should reject a name exceeding 100 characters (R-CRE-04)', async () => {
      const response = await request(httpServer)
        .post('/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'a'.repeat(101) })
        .expect(400);

      const body = response.body as ErrorBody;
      expect(body.statusCode).toBe(400);
    });
  });

  // ─── 401 Unauthorized ─────────────────────────────────────────────

  describe('401 Unauthorized', () => {
    it('should reject a request with no Authorization header (R-CRE-06)', async () => {
      await request(httpServer)
        .post('/rooms')
        .send({ name: 'Unauthenticated Room' })
        .expect(401);
    });
  });
});
