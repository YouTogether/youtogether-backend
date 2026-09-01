/**
 * Input for {@link IRealtimeStateWriter.initialisePlaybackState}.
 *
 * `leaderId` is resolved from the room's persisted `ownerId`, never
 * from client input and never from the authenticated caller — see
 * {@link CreateVideoSessionUseCase} for why that distinction matters.
 */
export interface InitialisePlaybackStateParams {
  readonly roomId: string;
  readonly youtubeVideoId: string;
  readonly leaderId: string;
}

/**
 * Domain port for the authoritative, server-side writes this bounded
 * context makes to the real-time store.
 *
 * ## Why the backend writes this node at all
 * Real-time playback (play/pause/seek, presence, the ready gate) is
 * handled entirely by the Flutter client against Firebase, per the data
 * model's Section 3 — this port is not a reversal of that split. It
 * covers exactly one write: the *creation* of
 * `rooms/{roomId}/playback_state`, which carries `youtube_video_id` and
 * `leader_id`.
 *
 * Those two fields decide who is allowed to command playback. If a
 * client created the node, the Realtime Database security rules would
 * have to permit any authenticated user to write a node that does not
 * yet exist — letting the first writer in a room name themselves
 * leader. Writing it from the backend, behind `OwnershipGuard` and with
 * administrative credentials, lets the rules forbid client creation
 * outright. Clients retain write access to the mutable fields
 * (`is_playing`, `timestamp_seconds`, `last_updated_at`) only.
 *
 * ## Deliberately narrow
 * One method, and no `update`/`delete`. Every subsequent mutation of
 * the node belongs to the client, and widening this port would
 * gradually move real-time state ownership to the backend, which the
 * architecture does not want.
 *
 * Declared as an abstract class rather than an interface so it can
 * serve as a NestJS injection token, mirroring
 * {@link IVideoSessionRepository} and `IRoomRepository`.
 *
 * @see FirebaseRealtimeStateService — the data layer implementation
 * @see CreateVideoSessionUseCase — the sole consumer
 */
export abstract class IRealtimeStateWriter {
  /**
   * Creates (or overwrites) the room's `playback_state` node in its
   * initial, paused-at-zero form.
   *
   * Overwriting is intended: adding a second video to an active room
   * replaces the node wholesale, and every connected viewer
   * re-synchronises from the new value through their live subscription.
   *
   * @param params - Room, video and leader identity for the new node.
   * @throws {RealtimeStateUnavailableFailure} if the write cannot be
   *   completed.
   */
  abstract initialisePlaybackState(
    params: InitialisePlaybackStateParams,
  ): Promise<void>;
}
