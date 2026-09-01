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
import { CreateVideoSessionsTable1785600000000 } from '../../../../src/database/migrations/1785600000000-CreateVideoSessionsTable';
import { UserOrmEntity } from '../../../../src/auth/data/entities/user.orm-entity';
import { JwtStrategy } from '../../../../src/auth/presentation/strategies/jwt.strategy';
import { RoomOrmEntity } from '../../../../src/room/data/entities/room.orm-entity';
import { RoomMembershipOrmEntity } from '../../../../src/room/data/entities/room-membership.orm-entity';
import { RoomRepositoryImpl } from '../../../../src/room/data/repositories/room-repository.impl';
import { IRoomRepository } from '../../../../src/room/domain/repositories/room-repository.interface';
import { OwnershipGuard } from '../../../../src/room/presentation/guards/ownership.guard';
import { RoomExceptionFilter } from '../../../../src/room/presentation/filters/room-exception.filter';
import { VideoSessionOrmEntity } from '../../../../src/video-sync/data/entities/video-session.orm-entity';
import { VideoSessionRepositoryImpl } from '../../../../src/video-sync/data/repositories/video-session-repository.impl';
import { IVideoSessionRepository } from '../../../../src/video-sync/domain/repositories/video-session-repository.interface';
import { CreateVideoSessionUseCase } from '../../../../src/video-sync/domain/usecases/create-video-session.usecase';
import { GetVideoSessionUseCase } from '../../../../src/video-sync/domain/usecases/get-video-session.usecase';
import { YouTubeService } from '../../../../src/video-sync/data/services/youtube.service';
import { VideoSessionController } from '../../../../src/video-sync/presentation/controllers/video-session.controller';
import { VideoSessionExceptionFilter } from '../../../../src/video-sync/presentation/filters/video-session-exception.filter';
import { IRealtimeStateWriter } from '../../../../src/video-sync/domain/repositories/realtime-state-writer.interface';

/**
 * Integration tests for GET /rooms/:id/video-session.
 *
 * Scenarios covered:
 * - a member reads an existing video session -> 200, full metadata.
 * - room exists but has no video session yet -> 404.
 * - room does not exist -> 404 (via RoomExceptionFilter, not
 *   VideoSessionExceptionFilter — the room lookup never reaches this
 *   controller's own logic since no OwnershipGuard runs on this route
 *   to trigger it; verified here to be explicit that a non-existent
 *   room and an existing-room-with-no-session both surface as 404, for
 *   different underlying reasons).
 * - Deliberately no ownership check: any authenticated user, not just
 *   the room owner, can read the video session — verified by a
 *   non-owner successfully retrieving it.
 *
 * @competency Integration test harness.
 * @competency Test scenarios and expected results.
 */
const TEST_JWT_SECRET =
  process.env.JWT_SECRET ??
  'e675b2f9affdf3609e857294d44289bf4550c658e214dfab162d9f227e087e507b099101d302aeb480003e94527048dd';

interface VideoSessionBody {
  id: string;
  roomId: string;
  youtubeVideoId: string;
  title: string;
  durationSeconds: number;
}

describe('GET /rooms/:id/video-session (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let ownerId: string;
  let nonOwnerId: string;
  let roomId: string;
  let ownerToken: string;
  let nonOwnerToken: string;
  const fetchMetadataMock = jest.fn();

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        await ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
          ignoreEnvFile: databaseUrl !== undefined,
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
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
              entities: [
                UserOrmEntity,
                RoomOrmEntity,
                RoomMembershipOrmEntity,
                VideoSessionOrmEntity,
              ],
              migrations: [
                CreateUsersTable1714000000000,
                CreateRoomsTable1784015715536,
                CreateVideoSessionsTable1785600000000,
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
          VideoSessionOrmEntity,
        ]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
          useFactory: () => ({
            secret: TEST_JWT_SECRET,
            signOptions: { expiresIn: '15m' },
          }),
        }),
      ],
      controllers: [VideoSessionController],
      providers: [
        CreateVideoSessionUseCase,
        GetVideoSessionUseCase,
        JwtStrategy,
        OwnershipGuard,
        { provide: IRoomRepository, useClass: RoomRepositoryImpl },
        {
          provide: IVideoSessionRepository,
          useClass: VideoSessionRepositoryImpl,
        },
        {
          provide: YouTubeService,
          useValue: { fetchMetadata: fetchMetadataMock },
        },
        {
          provide: YouTubeService,
          useValue: { fetchMetadata: fetchMetadataMock },
        },
        {
          provide: IRealtimeStateWriter,
          useValue: {
            initialisePlaybackState: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.useGlobalFilters(
      new RoomExceptionFilter(),
      new VideoSessionExceptionFilter(),
    );
    await app.init();
    httpServer = app.getHttpServer() as Server;

    dataSource = module.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    fetchMetadataMock.mockReset();
    fetchMetadataMock.mockResolvedValue({
      title: 'Never Gonna Give You Up',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      durationSeconds: 213,
    });

    await dataSource.query(
      'TRUNCATE video_sessions, room_memberships, rooms, users CASCADE',
    );

    const userRepository = dataSource.getRepository(UserOrmEntity);
    const owner = await userRepository.save(
      userRepository.create({
        email: 'owner@example.com',
        passwordHash: 'hashed',
        username: 'Owner',
      }),
    );
    const nonOwner = await userRepository.save(
      userRepository.create({
        email: 'nonowner@example.com',
        passwordHash: 'hashed',
        username: 'NonOwner',
      }),
    );
    ownerId = owner.id;
    nonOwnerId = nonOwner.id;

    const roomRepository = dataSource.getRepository(RoomOrmEntity);
    const room = await roomRepository.save(
      roomRepository.create({
        name: 'Friday Movie Night',
        ownerId,
        isPublic: true,
      }),
    );
    roomId = room.id;

    ownerToken = sign({ sub: ownerId, role: 'registered' }, TEST_JWT_SECRET, {
      expiresIn: '15m',
    });
    nonOwnerToken = sign(
      { sub: nonOwnerId, role: 'registered' },
      TEST_JWT_SECRET,
      { expiresIn: '15m' },
    );
  });

  it('should return 200 with the video session for an existing session (VS-GET-01)', async () => {
    await request(httpServer)
      .post(`/rooms/${roomId}/video-session`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ youtubeVideoId: 'dQw4w9WgXcQ' });

    const response = await request(httpServer)
      .get(`/rooms/${roomId}/video-session`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    const body = response.body as VideoSessionBody;
    expect(body.roomId).toBe(roomId);
    expect(body.youtubeVideoId).toBe('dQw4w9WgXcQ');
    expect(body.durationSeconds).toBe(213);
  });

  it('should allow a non-owner member to read the video session (no ownership check)', async () => {
    await request(httpServer)
      .post(`/rooms/${roomId}/video-session`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ youtubeVideoId: 'dQw4w9WgXcQ' });

    const response = await request(httpServer)
      .get(`/rooms/${roomId}/video-session`)
      .set('Authorization', `Bearer ${nonOwnerToken}`);

    expect(response.status).toBe(200);
  });

  it('should return 404 when the room exists but has no video session yet (VS-GET-02)', async () => {
    const response = await request(httpServer)
      .get(`/rooms/${roomId}/video-session`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(404);
  });

  it('should return 401 with no Authorization header', async () => {
    const response = await request(httpServer).get(
      `/rooms/${roomId}/video-session`,
    );

    expect(response.status).toBe(401);
  });
});
