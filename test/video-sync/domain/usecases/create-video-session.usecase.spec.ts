import { IVideoSessionRepository } from '../../../../src/video-sync/domain/repositories/video-session-repository.interface';
import { CreateVideoSessionUseCase } from '../../../../src/video-sync/domain/usecases/create-video-session.usecase';
import { CreateVideoSessionParams } from '../../../../src/video-sync/domain/usecases/create-video-session.params';
import { VideoSessionEntity } from '../../../../src/video-sync/domain/entities/video-session.entity';
import { YouTubeService } from '../../../../src/video-sync/data/services/youtube.service';
import { InvalidYoutubeVideoIdFailure } from '../../../../src/video-sync/domain/failures/video-session.failure';

/**
 * Unit tests for CreateVideoSessionUseCase.
 *
 * The use case is a thin orchestrator (format validation, delegate to
 * YouTubeService, delegate to the repository), mirroring the pattern
 * used by Room use cases and by `VideoSessionService`.
 *
 * @competency Unit test harness.
 */
describe('CreateVideoSessionUseCase', () => {
  let useCase: CreateVideoSessionUseCase;
  const fetchMetadataMock = jest.fn();
  const createMock = jest.fn();
  const findByRoomIdMock = jest.fn();

  const VALID_PARAMS = new CreateVideoSessionParams({
    roomId: '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f',
    youtubeVideoId: 'dQw4w9WgXcQ',
    addedBy: '550e8400-e29b-41d4-a716-446655440000',
  });

  const MOCK_SESSION = new VideoSessionEntity({
    id: 'session-uuid',
    roomId: VALID_PARAMS.roomId,
    youtubeVideoId: VALID_PARAMS.youtubeVideoId,
    title: 'Never Gonna Give You Up',
    thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    durationSeconds: 213,
    addedBy: VALID_PARAMS.addedBy,
    createdAt: new Date('2026-01-05T00:00:00Z'),
  });

  beforeEach(() => {
    fetchMetadataMock.mockReset();
    createMock.mockReset();
    findByRoomIdMock.mockReset();

    const videoSessionRepository: IVideoSessionRepository = {
      create: createMock,
      findByRoomId: findByRoomIdMock,
    };
    const youTubeService = {
      fetchMetadata: fetchMetadataMock,
    } as unknown as YouTubeService;

    useCase = new CreateVideoSessionUseCase(
      videoSessionRepository,
      youTubeService,
    );
  });

  it('should reject a malformed youtube video id before calling YouTubeService (VS-CRE-02)', async () => {
    const invalidParams = new CreateVideoSessionParams({
      ...VALID_PARAMS,
      youtubeVideoId: 'not-11-chars',
    });

    await expect(useCase.execute(invalidParams)).rejects.toThrow(
      InvalidYoutubeVideoIdFailure,
    );
    expect(fetchMetadataMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('should fetch metadata via YouTubeService for a valid id', async () => {
    fetchMetadataMock.mockResolvedValue({
      title: 'Never Gonna Give You Up',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      durationSeconds: 213,
    });
    createMock.mockResolvedValue(MOCK_SESSION);

    await useCase.execute(VALID_PARAMS);

    expect(fetchMetadataMock).toHaveBeenCalledWith(VALID_PARAMS.youtubeVideoId);
  });

  it('should delegate persistence to IVideoSessionRepository.create with the resolved metadata (VS-CRE-01)', async () => {
    const metadata = {
      title: 'Never Gonna Give You Up',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      durationSeconds: 213,
    };
    fetchMetadataMock.mockResolvedValue(metadata);
    createMock.mockResolvedValue(MOCK_SESSION);

    await useCase.execute(VALID_PARAMS);

    expect(createMock).toHaveBeenCalledWith(
      {
        roomId: VALID_PARAMS.roomId,
        youtubeVideoId: VALID_PARAMS.youtubeVideoId,
        addedBy: VALID_PARAMS.addedBy,
      },
      metadata,
    );
  });

  it('should return the VideoSessionEntity produced by the repository', async () => {
    fetchMetadataMock.mockResolvedValue({
      title: 'Never Gonna Give You Up',
      thumbnailUrl: null,
      durationSeconds: 213,
    });
    createMock.mockResolvedValue(MOCK_SESSION);

    const result = await useCase.execute(VALID_PARAMS);

    expect(result).toBe(MOCK_SESSION);
  });

  it('should propagate a YouTubeService failure unchanged (VS-CRE-02, upstream errors)', async () => {
    fetchMetadataMock.mockRejectedValue(new Error('upstream failure'));

    await expect(useCase.execute(VALID_PARAMS)).rejects.toThrow(
      'upstream failure',
    );
    expect(createMock).not.toHaveBeenCalled();
  });
});
