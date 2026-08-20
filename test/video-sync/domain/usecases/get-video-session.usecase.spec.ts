import { IVideoSessionRepository } from '../../../../src/video-sync/domain/repositories/video-session-repository.interface';
import { GetVideoSessionUseCase } from '../../../../src/video-sync/domain/usecases/get-video-session.usecase';
import { VideoSessionEntity } from '../../../../src/video-sync/domain/entities/video-session.entity';
import { VideoSessionNotFoundFailure } from '../../../../src/video-sync/domain/failures/video-session.failure';

/**
 * Unit tests for GetVideoSessionUseCase.
 *
 * @competency Unit test harness.
 * @competency Test scenarios.
 */
describe('GetVideoSessionUseCase', () => {
  let useCase: GetVideoSessionUseCase;
  const findByRoomIdMock = jest.fn();

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

  beforeEach(() => {
    findByRoomIdMock.mockReset();

    const videoSessionRepository: IVideoSessionRepository = {
      create: jest.fn(),
      findByRoomId: findByRoomIdMock,
    };

    useCase = new GetVideoSessionUseCase(videoSessionRepository);
  });

  it('should delegate to IVideoSessionRepository.findByRoomId (VS-GET-01)', async () => {
    findByRoomIdMock.mockResolvedValue(MOCK_SESSION);

    await useCase.execute(ROOM_ID);

    expect(findByRoomIdMock).toHaveBeenCalledWith(ROOM_ID);
  });

  it('should return the VideoSessionEntity when one exists (VS-GET-01)', async () => {
    findByRoomIdMock.mockResolvedValue(MOCK_SESSION);

    const result = await useCase.execute(ROOM_ID);

    expect(result).toBe(MOCK_SESSION);
  });

  it('should throw VideoSessionNotFoundFailure when the room has no video session (VS-GET-02)', async () => {
    findByRoomIdMock.mockResolvedValue(null);

    await expect(useCase.execute(ROOM_ID)).rejects.toThrow(
      VideoSessionNotFoundFailure,
    );
  });
});
