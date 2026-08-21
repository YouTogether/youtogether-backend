import { Test, TestingModule } from '@nestjs/testing';

import { VideoSessionController } from '../../../../src/video-sync/presentation/controllers/video-session.controller';
import { CreateVideoSessionUseCase } from '../../../../src/video-sync/domain/usecases/create-video-session.usecase';
import { CreateVideoSessionParams } from '../../../../src/video-sync/domain/usecases/create-video-session.params';
import { GetVideoSessionUseCase } from '../../../../src/video-sync/domain/usecases/get-video-session.usecase';
import { CreateVideoSessionDto } from '../../../../src/video-sync/presentation/dtos/create-video-session.dto';
import { VideoSessionResponseDto } from '../../../../src/video-sync/presentation/dtos/video-session-response.dto';
import { VideoSessionEntity } from '../../../../src/video-sync/domain/entities/video-session.entity';
import { AuthenticatedUser } from '../../../../src/auth/presentation/interfaces/authenticated-user.interface';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';
import { IRoomRepository } from '../../../../src/room/domain/repositories/room-repository.interface';

/**
 * Unit tests for VideoSessionController.create (presentation layer).
 *
 * Neither JwtAuthGuard nor OwnershipGuard is exercised here — guard
 * rejection (401/403/404) is verified by
 * `create-video-session.integration.spec.ts` against a fully
 * bootstrapped application, mirroring `room.controller.spec.ts`.
 *
 * `IRoomRepository` is nonetheless provided (as an unused stub) because
 * `create()` is decorated with `@UseGuards(JwtAuthGuard, OwnershipGuard)`:
 * Nest resolves every guard referenced by class in that decorator when
 * compiling the TestingModule, regardless of whether the guard's
 * `canActivate()` is ever invoked in a given test — and `OwnershipGuard`
 * (reused as-is from the Room bounded context) has a constructor
 * dependency on `IRoomRepository`. Without this stub,
 * `Test.createTestingModule(...).compile()` throws
 * `UnknownDependenciesException` for every test in this file, exactly as
 * documented in `room.controller.spec.ts` for its own `update()`/`remove()`
 * routes.
 *
 * @competency Unit test harness.
 */
describe('VideoSessionController', () => {
  let controller: VideoSessionController;
  const executeMock = jest.fn();

  const ROOM_ID = '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f';

  const AUTHENTICATED_USER: AuthenticatedUser = {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    role: UserRole.REGISTERED,
  };

  const VALID_DTO: CreateVideoSessionDto = Object.assign(
    new CreateVideoSessionDto(),
    { youtubeVideoId: 'dQw4w9WgXcQ' },
  );

  const MOCK_SESSION = new VideoSessionEntity({
    id: 'session-uuid',
    roomId: ROOM_ID,
    youtubeVideoId: 'dQw4w9WgXcQ',
    title: 'Never Gonna Give You Up',
    thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    durationSeconds: 213,
    addedBy: AUTHENTICATED_USER.userId,
    createdAt: new Date('2026-01-05T00:00:00Z'),
  });

  const roomRepositoryStub: Pick<IRoomRepository, 'findOwnerId'> = {
    findOwnerId: jest.fn(),
  };

  const getVideoSessionExecuteMock = jest.fn();

  beforeEach(async () => {
    executeMock.mockReset();
    getVideoSessionExecuteMock.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VideoSessionController],
      providers: [
        {
          provide: CreateVideoSessionUseCase,
          useValue: { execute: executeMock },
        },
        {
          provide: GetVideoSessionUseCase,
          useValue: { execute: getVideoSessionExecuteMock },
        },
        { provide: IRoomRepository, useValue: roomRepositoryStub },
      ],
    }).compile();

    controller = module.get<VideoSessionController>(VideoSessionController);
  });

  it('should return a VideoSessionResponseDto on success', async () => {
    executeMock.mockResolvedValue(MOCK_SESSION);

    const response = await controller.create(
      ROOM_ID,
      VALID_DTO,
      AUTHENTICATED_USER,
    );

    expect(response).toBeInstanceOf(VideoSessionResponseDto);
    expect(response.id).toBe(MOCK_SESSION.id);
  });

  it('should call CreateVideoSessionUseCase.execute with params built from the route, DTO, and authenticated user', async () => {
    executeMock.mockResolvedValue(MOCK_SESSION);

    await controller.create(ROOM_ID, VALID_DTO, AUTHENTICATED_USER);

    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining<Partial<CreateVideoSessionParams>>({
        roomId: ROOM_ID,
        youtubeVideoId: VALID_DTO.youtubeVideoId,
        addedBy: AUTHENTICATED_USER.userId,
      }),
    );
  });

  it('should never take addedBy from the request body', async () => {
    executeMock.mockResolvedValue(MOCK_SESSION);
    // CreateVideoSessionDto has no addedBy field at all — the global
    // ValidationPipe's `whitelist: true` strips it well before this
    // point in the real request flow; verified here defensively.
    const dtoWithSpoofedAuthor = Object.assign(new CreateVideoSessionDto(), {
      youtubeVideoId: 'dQw4w9WgXcQ',
    });

    await controller.create(ROOM_ID, dtoWithSpoofedAuthor, AUTHENTICATED_USER);

    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({ addedBy: AUTHENTICATED_USER.userId }),
    );
  });
});

/**
 * Unit tests for VideoSessionController.findOne.
 *
 * @competency Unit test harness.
 * @competency Test scenarios (presentation-layer slice).
 */
describe('VideoSessionController.findOne', () => {
  let controller: VideoSessionController;
  const getVideoSessionExecuteMock = jest.fn();

  const ROOM_ID = '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f';

  const MOCK_SESSION = new VideoSessionEntity({
    id: 'session-uuid',
    roomId: ROOM_ID,
    youtubeVideoId: 'dQw4w9WgXcQ',
    title: 'Never Gonna Give You Up',
    thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    durationSeconds: 213,
    addedBy: '550e8400-e29b-41d4-a716-446655440000',
    createdAt: new Date('2026-01-05T00:00:00Z'),
  });

  const roomRepositoryStub: Pick<IRoomRepository, 'findOwnerId'> = {
    findOwnerId: jest.fn(),
  };

  beforeEach(async () => {
    getVideoSessionExecuteMock.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VideoSessionController],
      providers: [
        {
          provide: CreateVideoSessionUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: GetVideoSessionUseCase,
          useValue: { execute: getVideoSessionExecuteMock },
        },
        { provide: IRoomRepository, useValue: roomRepositoryStub },
      ],
    }).compile();

    controller = module.get<VideoSessionController>(VideoSessionController);
  });

  it('should return a VideoSessionResponseDto built from the found entity (VS-GET-01)', async () => {
    getVideoSessionExecuteMock.mockResolvedValue(MOCK_SESSION);

    const response = await controller.findOne(ROOM_ID);

    expect(response).toBeInstanceOf(VideoSessionResponseDto);
    expect(response.durationSeconds).toBe(213);
  });

  it('should call GetVideoSessionUseCase.execute with the room id from the route', async () => {
    getVideoSessionExecuteMock.mockResolvedValue(MOCK_SESSION);

    await controller.findOne(ROOM_ID);

    expect(getVideoSessionExecuteMock).toHaveBeenCalledWith(ROOM_ID);
  });
});
