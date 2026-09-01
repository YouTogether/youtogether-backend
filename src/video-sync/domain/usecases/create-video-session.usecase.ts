import { Injectable } from '@nestjs/common';

import { IVideoSessionRepository } from '../repositories/video-session-repository.interface';
import { IRealtimeStateWriter } from '../repositories/realtime-state-writer.interface';
import { VideoSessionEntity } from '../entities/video-session.entity';
import { CreateVideoSessionParams } from './create-video-session.params';
import { InvalidYoutubeVideoIdFailure } from '../failures/video-session.failure';
import { YouTubeService } from '../../data/services/youtube.service';
import { IRoomRepository } from '../../../room/domain/repositories/room-repository.interface';
import { RoomNotFoundFailure } from '../../../room/domain/failures/room.failure';

/**
 * YouTube video id format: 11 characters, letters, digits, `-`, `_`.
 * Duplicated from `CreateVideoSessionDto`'s `@Matches` pattern
 * deliberately (see `InvalidYoutubeVideoIdFailure`'s own doc comment for
 * why this is defense in depth rather than redundancy to remove).
 */
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * Orchestrates video session creation: validates the video id format,
 * resolves the room's leader, resolves the video's metadata via
 * {@link YouTubeService}, persists the session through
 * {@link IVideoSessionRepository}, and initializes the room's real-time
 * `playback_state` node through {@link IRealtimeStateWriter}.
 *
 * ## Step order
 * 1. **Format validation** — rejects malformed input before any
 *    outbound call, so a bad id never consumes YouTube API quota.
 * 2. **Leader resolution** — a cheap local query that also catches a
 *    room deleted between `OwnershipGuard` and this point; running it
 *    before the YouTube call avoids spending quota on a doomed request.
 * 3. **Metadata resolution** — the only slow, quota-bearing step.
 * 4. **Persistence** — PostgreSQL is the source of truth.
 * 5. **Real-time initialization** — mirrors the decision into Firebase.
 *
 * ## Why `leaderId` is not `params.addedBy`
 * Both values are the same user in every legitimate request: the route
 * is guarded by `OwnershipGuard`, so only the owner reaches this use
 * case, and `addedBy` is the authenticated caller. Deriving the leader
 * from the room's persisted `ownerId` anyway is deliberate.
 *
 * `leader_id` is not a display field. It is the value the Realtime
 * Database security rules compare against `auth.uid` to decide who may
 * command playback (B-A06). Anchoring an authorization input on a
 * presentation-layer guard would mean that relaxing or reordering that
 * guard silently grants leadership to whoever posts first. The extra
 * `findOwnerId` query keeps the domain correct on its own terms.
 *
 * ## Transactional boundary
 * Steps 4 and 5 write to two different stores and cannot share a
 * transaction. See {@link RealtimeStateUnavailableFailure} for the
 * ordering rationale and the client-side recovery path.
 *
 * @competency Evolvable, secure orchestration logic
 * @competency Access control anchored in persisted state (OWASP A01:2021)
 */
@Injectable()
export class CreateVideoSessionUseCase {
  constructor(
    private readonly videoSessionRepository: IVideoSessionRepository,
    private readonly youTubeService: YouTubeService,
    private readonly roomRepository: IRoomRepository,
    private readonly realtimeStateWriter: IRealtimeStateWriter,
  ) {}

  /**
   * @param params - Validated creation input; `addedBy` is always the
   *   authenticated caller, never client-supplied.
   * @returns The persisted {@link VideoSessionEntity}.
   * @throws {InvalidYoutubeVideoIdFailure} on a malformed video id.
   * @throws {RoomNotFoundFailure} if the room no longer exists.
   * @throws {YoutubeVideoNotFoundFailure} if the video does not resolve.
   * @throws {YoutubeApiUnavailableFailure} if YouTube cannot be reached.
   * @throws {RealtimeStateUnavailableFailure} if the `playback_state`
   *   node could not be written — note that the session row is already
   *   committed at that point.
   */
  async execute(params: CreateVideoSessionParams): Promise<VideoSessionEntity> {
    if (!YOUTUBE_VIDEO_ID_PATTERN.test(params.youtubeVideoId)) {
      throw new InvalidYoutubeVideoIdFailure(params.youtubeVideoId);
    }

    const leaderId = await this.roomRepository.findOwnerId(params.roomId);
    if (leaderId === null) {
      throw new RoomNotFoundFailure(params.roomId);
    }

    const metadata = await this.youTubeService.fetchMetadata(
      params.youtubeVideoId,
    );

    const session = await this.videoSessionRepository.create(
      {
        roomId: params.roomId,
        youtubeVideoId: params.youtubeVideoId,
        addedBy: params.addedBy,
      },
      metadata,
    );

    await this.realtimeStateWriter.initialisePlaybackState({
      roomId: params.roomId,
      youtubeVideoId: params.youtubeVideoId,
      leaderId,
    });

    return session;
  }
}
