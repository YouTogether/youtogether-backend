import { IVideoSessionRepository } from '../../../../src/video-sync/domain/repositories/video-session-repository.interface';
import { IRealtimeStateWriter } from '../../../../src/video-sync/domain/repositories/realtime-state-writer.interface';
import { CreateVideoSessionUseCase } from '../../../../src/video-sync/domain/usecases/create-video-session.usecase';
import { CreateVideoSessionParams } from '../../../../src/video-sync/domain/usecases/create-video-session.params';
import { VideoSessionEntity } from '../../../../src/video-sync/domain/entities/video-session.entity';
import { YouTubeService } from '../../../../src/video-sync/data/services/youtube.service';
import {
  InvalidYoutubeVideoIdFailure,
  RealtimeStateUnavailableFailure,
} from '../../../../src/video-sync/domain/failures/video-session.failure';
import { IRoomRepository } from '../../../../src/room/domain/repositories/room-repository.interface';
import { RoomNotFoundFailure } from '../../../../src/room/domain/failures/room.failure';

/**
 * Unit tests for CreateVideoSessionUseCase.
 *
 * The use case is a thin orchestrator (format validation, leader
 * resolution, delegate to YouTubeService, delegate to the repository,
 * delegate to the realtime writer), mirroring the pattern used by Room
 * use cases.
 *
 * Two properties carry most of the weight here and are asserted
 * explicitly rather than incidentally:
 *
 * - **`leader_id` comes from the room's persisted owner**, never from
 *   the authenticated caller. It is an authorisation input for the
 *   Realtime Database security rules, so a test pins it to the owner
 *   even in the (guard-prevented) case where the two differ.
 * - **Nothing is written to the realtime store unless persistence
 *   succeeded first.** The two stores are not transactional; the
 *   ordering is the only guarantee available.
 *
 * @competency Unit test harness, TDD cycle.
 * @competency Test scenarios VS-CRE-01, VS-CRE-02, VS-CRE-05, VS-CRE-06.
 */
describe('CreateVideoSessionUseCase', () => {
  let useCase: CreateVideoSessionUseCase;
  const fetchMetadataMock = jest.fn();
  const createMock = jest.fn();
  const findByRoomIdMock = jest.fn();
  const findOwnerIdMock = jest.fn();
  const initialisePlaybackStateMock = jest.fn();

  const OWNER_ID = '550e8400-e29b-41d4-a716-446655440000';

  const VALID_PARAMS = new CreateVideoSessionParams({
    roomId: '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f',
    youtubeVideoId: 'dQw4w9WgXcQ',
    addedBy: OWNER_ID,
  });

  const METADATA = {
    title: 'Never Gonna Give You Up',
    thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    durationSeconds: 213,
  };

  const MOCK_SESSION = new VideoSessionEntity({
    id: 'session-uuid',
    roomId: VALID_PARAMS.roomId,
    youtubeVideoId: VALID_PARAMS.youtubeVideoId,
    title: METADATA.title,
    thumbnailUrl: METADATA.thumbnailUrl,
    durationSeconds: METADATA.durationSeconds,
    addedBy: VALID_PARAMS.addedBy,
    createdAt: new Date('2026-01-05T00:00:00Z'),
  });

  beforeEach(() => {
    fetchMetadataMock.mockReset();
    createMock.mockReset();
    findByRoomIdMock.mockReset();
    findOwnerIdMock.mockReset();
    initialisePlaybackStateMock.mockReset();

    findOwnerIdMock.mockResolvedValue(OWNER_ID);
    initialisePlaybackStateMock.mockResolvedValue(undefined);

    const videoSessionRepository: IVideoSessionRepository = {
      create: createMock,
      findByRoomId: findByRoomIdMock,
    };
    const youTubeService = {
      fetchMetadata: fetchMetadataMock,
    } as unknown as YouTubeService;
    const roomRepository = {
      findOwnerId: findOwnerIdMock,
    } as unknown as IRoomRepository;
    const realtimeStateWriter: IRealtimeStateWriter = {
      initialisePlaybackState: initialisePlaybackStateMock,
    };

    useCase = new CreateVideoSessionUseCase(
      videoSessionRepository,
      youTubeService,
      roomRepository,
      realtimeStateWriter,
    );
  });

  // --- format validation ---

  it('should reject a malformed youtube video id before calling YouTubeService (VS-CRE-02)', async () => {
    const invalidParams = new CreateVideoSessionParams({
      ...VALID_PARAMS,
      youtubeVideoId: 'not-11-chars',
    });

    await expect(useCase.execute(invalidParams)).rejects.toThrow(
      InvalidYoutubeVideoIdFailure,
    );
    expect(findOwnerIdMock).not.toHaveBeenCalled();
    expect(fetchMetadataMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
    expect(initialisePlaybackStateMock).not.toHaveBeenCalled();
  });

  // --- leader resolution ---

  it('should resolve the leader from the room owner before spending YouTube API quota', async () => {
    fetchMetadataMock.mockResolvedValue(METADATA);
    createMock.mockResolvedValue(MOCK_SESSION);

    await useCase.execute(VALID_PARAMS);

    expect(findOwnerIdMock).toHaveBeenCalledWith(VALID_PARAMS.roomId);
    expect(findOwnerIdMock.mock.invocationCallOrder[0]).toBeLessThan(
      fetchMetadataMock.mock.invocationCallOrder[0],
    );
  });

  it('should throw RoomNotFoundFailure when the room no longer has an owner', async () => {
    findOwnerIdMock.mockResolvedValue(null);

    await expect(useCase.execute(VALID_PARAMS)).rejects.toThrow(
      RoomNotFoundFailure,
    );
    expect(fetchMetadataMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
    expect(initialisePlaybackStateMock).not.toHaveBeenCalled();
  });

  it("should take leader_id from the room's owner, not from the authenticated caller", async () => {
    // OwnershipGuard makes this divergence unreachable over HTTP. The
    // assertion exists so that relaxing or reordering that guard cannot
    // silently hand leadership to whoever posts first: `leader_id` is
    // an authorisation input for the Realtime Database rules, and it
    // must stay anchored in persisted state.
    findOwnerIdMock.mockResolvedValue(OWNER_ID);
    fetchMetadataMock.mockResolvedValue(METADATA);
    createMock.mockResolvedValue(MOCK_SESSION);

    const paramsFromAnotherUser = new CreateVideoSessionParams({
      ...VALID_PARAMS,
      addedBy: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    });

    await useCase.execute(paramsFromAnotherUser);

    expect(initialisePlaybackStateMock).toHaveBeenCalledWith(
      expect.objectContaining({ leaderId: OWNER_ID }),
    );
  });

  // --- metadata resolution ---

  it('should fetch metadata via YouTubeService for a valid id', async () => {
    fetchMetadataMock.mockResolvedValue(METADATA);
    createMock.mockResolvedValue(MOCK_SESSION);

    await useCase.execute(VALID_PARAMS);

    expect(fetchMetadataMock).toHaveBeenCalledWith(VALID_PARAMS.youtubeVideoId);
  });

  it('should propagate a YouTubeService failure unchanged (VS-CRE-02, upstream errors)', async () => {
    fetchMetadataMock.mockRejectedValue(new Error('upstream failure'));

    await expect(useCase.execute(VALID_PARAMS)).rejects.toThrow(
      'upstream failure',
    );
    expect(createMock).not.toHaveBeenCalled();
    expect(initialisePlaybackStateMock).not.toHaveBeenCalled();
  });

  // --- persistence ---

  it('should delegate persistence to IVideoSessionRepository.create with the resolved metadata (VS-CRE-01)', async () => {
    fetchMetadataMock.mockResolvedValue(METADATA);
    createMock.mockResolvedValue(MOCK_SESSION);

    await useCase.execute(VALID_PARAMS);

    expect(createMock).toHaveBeenCalledWith(
      {
        roomId: VALID_PARAMS.roomId,
        youtubeVideoId: VALID_PARAMS.youtubeVideoId,
        addedBy: VALID_PARAMS.addedBy,
      },
      METADATA,
    );
  });

  it('should return the VideoSessionEntity produced by the repository', async () => {
    fetchMetadataMock.mockResolvedValue(METADATA);
    createMock.mockResolvedValue(MOCK_SESSION);

    const result = await useCase.execute(VALID_PARAMS);

    expect(result).toBe(MOCK_SESSION);
  });

  // --- realtime initialisation ---

  it('should initialise the realtime playback state after persistence succeeds (VS-CRE-05)', async () => {
    fetchMetadataMock.mockResolvedValue(METADATA);
    createMock.mockResolvedValue(MOCK_SESSION);

    await useCase.execute(VALID_PARAMS);

    expect(initialisePlaybackStateMock).toHaveBeenCalledWith({
      roomId: VALID_PARAMS.roomId,
      youtubeVideoId: VALID_PARAMS.youtubeVideoId,
      leaderId: OWNER_ID,
    });
    expect(createMock.mock.invocationCallOrder[0]).toBeLessThan(
      initialisePlaybackStateMock.mock.invocationCallOrder[0],
    );
  });

  it('should not touch the realtime store when persistence fails', async () => {
    fetchMetadataMock.mockResolvedValue(METADATA);
    createMock.mockRejectedValue(new Error('constraint violation'));

    await expect(useCase.execute(VALID_PARAMS)).rejects.toThrow(
      'constraint violation',
    );
    expect(initialisePlaybackStateMock).not.toHaveBeenCalled();
  });

  it('should propagate RealtimeStateUnavailableFailure after the row was committed (VS-CRE-06)', async () => {
    fetchMetadataMock.mockResolvedValue(METADATA);
    createMock.mockResolvedValue(MOCK_SESSION);
    initialisePlaybackStateMock.mockRejectedValue(
      new RealtimeStateUnavailableFailure('permission_denied'),
    );

    await expect(useCase.execute(VALID_PARAMS)).rejects.toThrow(
      RealtimeStateUnavailableFailure,
    );
    // The session row is deliberately left in place: the write is
    // idempotent and a retried creation converges. See
    // RealtimeStateUnavailableFailure's own doc comment.
    expect(createMock).toHaveBeenCalledTimes(1);
  });
});
