import { ServerValue } from 'firebase-admin/database';

import { FirebaseAdminService } from '../../../../src/firebase/firebase-admin.service';
import { FirebaseRealtimeStateService } from '../../../../src/video-sync/data/services/firebase-realtime-state.service';
import { RealtimeStateUnavailableFailure } from '../../../../src/video-sync/domain/failures/video-session.failure';

/**
 * Unit tests for FirebaseRealtimeStateService.
 *
 * The Firebase Admin SDK is stubbed at the {@link FirebaseAdminService}
 * boundary rather than mocked module-wide with `jest.mock`, mirroring
 * how `youtube.service.spec.ts` stubs `fetch`: the assertions target
 * the reference path and the payload shape, which is exactly the
 * contract shared with the Flutter client and with the Realtime
 * Database security rules.
 *
 * The payload assertions are deliberately literal. `VideoSessionModel`
 * on the frontend deserialises these snake_case keys by name, so a
 * silent rename here would break every connected client at runtime
 * while every other test kept passing.
 *
 * @competency Unit test harness, TDD cycle.
 * @competency Test scenarios VS-CRE-05, VS-CRE-06.
 */
describe('FirebaseRealtimeStateService', () => {
  let service: FirebaseRealtimeStateService;

  const setMock = jest.fn();
  const refMock = jest.fn();

  const ROOM_ID = '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f';
  const LEADER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const VIDEO_ID = 'dQw4w9WgXcQ';

  beforeEach(() => {
    setMock.mockReset();
    setMock.mockResolvedValue(undefined);
    refMock.mockReset();
    refMock.mockReturnValue({ set: setMock });

    const firebaseAdminService = {
      database: { ref: refMock },
    } as unknown as FirebaseAdminService;

    service = new FirebaseRealtimeStateService(firebaseAdminService);
  });

  it("should write to the room's playback_state node", async () => {
    await service.initialisePlaybackState({
      roomId: ROOM_ID,
      youtubeVideoId: VIDEO_ID,
      leaderId: LEADER_ID,
    });

    expect(refMock).toHaveBeenCalledWith(`rooms/${ROOM_ID}/playback_state`);
    expect(setMock).toHaveBeenCalledTimes(1);
  });

  it('should write the full node in one set(), never a partial update (VS-CRE-05)', async () => {
    await service.initialisePlaybackState({
      roomId: ROOM_ID,
      youtubeVideoId: VIDEO_ID,
      leaderId: LEADER_ID,
    });

    const [payload] = setMock.mock.calls[0] as [Record<string, unknown>];
    expect(Object.keys(payload).sort()).toEqual([
      'is_playing',
      'last_updated_at',
      'leader_id',
      'timestamp_seconds',
      'youtube_video_id',
    ]);
  });

  it('should use the snake_case keys expected by the Flutter client', async () => {
    await service.initialisePlaybackState({
      roomId: ROOM_ID,
      youtubeVideoId: VIDEO_ID,
      leaderId: LEADER_ID,
    });

    const [payload] = setMock.mock.calls[0] as [Record<string, unknown>];
    expect(payload.youtube_video_id).toBe(VIDEO_ID);
    expect(payload.leader_id).toBe(LEADER_ID);
  });

  it('should start the session paused at position zero', async () => {
    await service.initialisePlaybackState({
      roomId: ROOM_ID,
      youtubeVideoId: VIDEO_ID,
      leaderId: LEADER_ID,
    });

    const [payload] = setMock.mock.calls[0] as [Record<string, unknown>];
    expect(payload.is_playing).toBe(false);
    expect(payload.timestamp_seconds).toBe(0);
  });

  it("should stamp last_updated_at with Firebase's server clock, not the host clock", async () => {
    await service.initialisePlaybackState({
      roomId: ROOM_ID,
      youtubeVideoId: VIDEO_ID,
      leaderId: LEADER_ID,
    });

    const [payload] = setMock.mock.calls[0] as [Record<string, unknown>];
    expect(payload.last_updated_at).toBe(ServerValue.TIMESTAMP);
  });

  it('should wrap a rejected write in RealtimeStateUnavailableFailure (VS-CRE-06)', async () => {
    setMock.mockRejectedValue(new Error('permission_denied'));

    await expect(
      service.initialisePlaybackState({
        roomId: ROOM_ID,
        youtubeVideoId: VIDEO_ID,
        leaderId: LEADER_ID,
      }),
    ).rejects.toThrow(RealtimeStateUnavailableFailure);
  });

  it('should preserve the underlying cause in the failure message', async () => {
    setMock.mockRejectedValue(new Error('permission_denied'));

    await expect(
      service.initialisePlaybackState({
        roomId: ROOM_ID,
        youtubeVideoId: VIDEO_ID,
        leaderId: LEADER_ID,
      }),
    ).rejects.toThrow(/permission_denied/);
  });

  it('should not leak a non-Error rejection value into the message', async () => {
    setMock.mockRejectedValue('some string');

    await expect(
      service.initialisePlaybackState({
        roomId: ROOM_ID,
        youtubeVideoId: VIDEO_ID,
        leaderId: LEADER_ID,
      }),
    ).rejects.toThrow(/unknown error/);
  });
});
