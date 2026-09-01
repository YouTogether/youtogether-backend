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
 * Integration tests for POST /rooms/:id/video-session.
 *
 * Scenarios covered (cahier de recette, sprint-3-videosync-planning.md §5):
 * - owner creates a session with a valid id -> 201, metadata cached.
 * - malformed video id -> 400.
 * - non-owner attempts creation -> 403.
 * - room does not exist -> 404.
 *
 * `YouTubeService.fetchMetadata` is stubbed at the provider level (rather
 * than stubbing `global.fetch`) so this suite exercises the full
 * controller -> use case -> repository -> database chain without a real
 * network call to the YouTube Data API — mirroring how Room integration
 * tests exercise a real database but never a real external dependency.
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
  thumbnailUrl: string | null;
  durationSeconds: number;
  addedBy: string;
}

interface ErrorBody {
  statusCode: number;
  message: string | string[];
}

describe('POST /rooms/:id/video-session (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let ownerId: string;
  let nonOwnerId: string;
  let roomId: string;
  let ownerToken: string;
  let nonOwnerToken: string;
  const fetchMetadataMock = jest.fn();
  const initialisePlaybackStateMock = jest.fn();

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
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
          provide: IRealtimeStateWriter,
          useValue: { initialisePlaybackState: initialisePlaybackStateMock },
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
    initialisePlaybackStateMock.mockReset();
    initialisePlaybackStateMock.mockResolvedValue(undefined);
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

  it('should return 201 with the created session for a valid id from the owner (VS-CRE-01)', async () => {
    const response = await request(httpServer)
      .post(`/rooms/${roomId}/video-session`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ youtubeVideoId: 'dQw4w9WgXcQ' });

    expect(response.status).toBe(201);
    const body = response.body as VideoSessionBody;
    expect(body.roomId).toBe(roomId);
    expect(body.youtubeVideoId).toBe('dQw4w9WgXcQ');
    expect(body.title).toBe('Never Gonna Give You Up');
    expect(body.durationSeconds).toBe(213);
    expect(body.addedBy).toBe(ownerId);
  });

  it('should return 400 for a malformed youtube video id (VS-CRE-02)', async () => {
    const response = await request(httpServer)
      .post(`/rooms/${roomId}/video-session`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ youtubeVideoId: 'not-valid' });

    expect(response.status).toBe(400);
    expect(fetchMetadataMock).not.toHaveBeenCalled();
  });

  it('should return 403 when a non-owner attempts to create a session (VS-CRE-03)', async () => {
    const response = await request(httpServer)
      .post(`/rooms/${roomId}/video-session`)
      .set('Authorization', `Bearer ${nonOwnerToken}`)
      .send({ youtubeVideoId: 'dQw4w9WgXcQ' });

    expect(response.status).toBe(403);
  });

  it('should return 404 when the room does not exist (VS-CRE-04)', async () => {
    const response = await request(httpServer)
      .post('/rooms/00000000-0000-4000-8000-000000000000/video-session')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ youtubeVideoId: 'dQw4w9WgXcQ' });

    expect(response.status).toBe(404);
  });

  it('should return 401 with no Authorization header', async () => {
    const response = await request(httpServer)
      .post(`/rooms/${roomId}/video-session`)
      .send({ youtubeVideoId: 'dQw4w9WgXcQ' });

    expect(response.status).toBe(401);
  });

  it('should return 400 when the YouTube API reports the video was not found', async () => {
    fetchMetadataMock.mockRejectedValue(
      new (
        await import('../../../../src/video-sync/domain/failures/video-session.failure')
      ).YoutubeVideoNotFoundFailure('zzzzzzzzzzz'),
    );

    const response = await request(httpServer)
      .post(`/rooms/${roomId}/video-session`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ youtubeVideoId: 'zzzzzzzzzzz' });

    const body = response.body as ErrorBody;
    expect(response.status).toBe(400);
    expect(body.statusCode).toBe(400);
  });

  it('should return 502 when the YouTube API is unavailable', async () => {
    fetchMetadataMock.mockRejectedValue(
      new (
        await import('../../../../src/video-sync/domain/failures/video-session.failure')
      ).YoutubeApiUnavailableFailure('quota exceeded'),
    );

    const response = await request(httpServer)
      .post(`/rooms/${roomId}/video-session`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ youtubeVideoId: 'dQw4w9WgXcQ' });

    expect(response.status).toBe(502);
  });

  it('should initialise the realtime playback state with the room owner as leader (VS-CRE-05)', async () => {
    await request(httpServer)
      .post(`/rooms/${roomId}/video-session`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ youtubeVideoId: 'dQw4w9WgXcQ' });

    expect(initialisePlaybackStateMock).toHaveBeenCalledWith({
      roomId,
      youtubeVideoId: 'dQw4w9WgXcQ',
      leaderId: ownerId,
    });
  });

  it('should return 502 when the realtime state cannot be written (VS-CRE-06)', async () => {
    initialisePlaybackStateMock.mockRejectedValue(
      new (
        await import('../../../../src/video-sync/domain/failures/video-session.failure')
      ).RealtimeStateUnavailableFailure('permission_denied'),
    );

    const response = await request(httpServer)
      .post(`/rooms/${roomId}/video-session`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ youtubeVideoId: 'dQw4w9WgXcQ' });

    expect(response.status).toBe(502);
  });
});
