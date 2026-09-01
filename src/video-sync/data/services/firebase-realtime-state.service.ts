import { Injectable } from '@nestjs/common';
import { ServerValue } from 'firebase-admin/database';

import { FirebaseAdminService } from '../../../firebase/firebase-admin.service';
import {
  IRealtimeStateWriter,
  InitialisePlaybackStateParams,
} from '../../domain/repositories/realtime-state-writer.interface';
import { RealtimeStateUnavailableFailure } from '../../domain/failures/video-session.failure';

/**
 * Data layer implementation of {@link IRealtimeStateWriter}, backed by
 * the Firebase Realtime Database through {@link FirebaseAdminService}.
 *
 * ## Node shape
 * The payload keys are snake_case because they are a *contract with the
 * Flutter client*, not an internal representation: `VideoSessionModel`,
 * `PresenceModel` and `SyncBarrierModel` all serialise in snake_case,
 * and the security rules validate field by field against those exact
 * names. Renaming a key here silently breaks deserialisation on every
 * connected client and, once the strict rules land, produces a
 * `permission_denied` instead of a helpful error.
 *
 * A new session always starts paused at zero. The alternative — starting
 * playback immediately — would race every viewer's player initialisation
 * and is precisely what the ready gate exists to avoid
 * (`YouTogether_Ad_Synchronisation_Strategy.docx`, Section 4).
 *
 * ## Timestamp
 * `last_updated_at` is written with `ServerValue.TIMESTAMP` rather than
 * `Date.now()`. Firebase resolves the sentinel against its own clock, so
 * the initial value cannot be skewed by a drifting backend host. Client
 * writes still use their local clock, which remains a known limitation
 * of the synchronisation model — this at least establishes a trustworthy
 * origin.
 *
 * @see IRealtimeStateWriter — the domain port being implemented
 * @competency Evolvable, secure integration with an external dependency
 */
@Injectable()
export class FirebaseRealtimeStateService implements IRealtimeStateWriter {
  constructor(private readonly firebaseAdminService: FirebaseAdminService) {}

  /**
   * Writes the room's initial `playback_state` node.
   *
   * @param params - Room, video and leader identity for the new node.
   * @throws {RealtimeStateUnavailableFailure} on any SDK or network
   *   error, mapped to HTTP 502 by `VideoSessionExceptionFilter` — the
   *   request was well formed, an upstream dependency could not fulfil
   *   it, exactly as for `YoutubeApiUnavailableFailure`.
   */
  async initialisePlaybackState(
    params: InitialisePlaybackStateParams,
  ): Promise<void> {
    const reference = this.firebaseAdminService.database.ref(
      `rooms/${params.roomId}/playback_state`,
    );

    try {
      await reference.set({
        youtube_video_id: params.youtubeVideoId,
        is_playing: false,
        timestamp_seconds: 0,
        leader_id: params.leaderId,
        last_updated_at: ServerValue.TIMESTAMP,
      });
    } catch (error) {
      throw new RealtimeStateUnavailableFailure(
        error instanceof Error ? error.message : 'unknown error',
      );
    }
  }
}
