/**
 * Thrown when the supplied YouTube video ID does not match the expected
 * 11-character format.
 *
 * This is a defense-in-depth duplicate of `CreateVideoSessionDto`'s own
 * `@Matches` validation: the DTO rejects malformed input before it
 * reaches the service in the normal HTTP flow, but the service-level
 * check protects any other caller of `VideoSessionService.create`
 * (e.g. a future internal job) that might bypass the DTO.
 *
 * The presentation layer maps this failure to HTTP 400 Bad Request via
 * {@link VideoSessionExceptionFilter}.
 *
 * @see VideoSessionExceptionFilter
 */
export class InvalidYoutubeVideoIdFailure extends Error {
  readonly youtubeVideoId: string;

  constructor(youtubeVideoId: string) {
    super(`"${youtubeVideoId}" is not a valid YouTube video id.`);
    this.name = 'InvalidYoutubeVideoIdFailure';
    this.youtubeVideoId = youtubeVideoId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the YouTube Data API v3 reports that the requested video
 * does not exist (or is private/deleted, which the API surfaces
 * identically to "not found").
 *
 * The presentation layer maps this failure to HTTP 400 Bad Request via
 * {@link VideoSessionExceptionFilter} — from the caller's perspective
 * this is the same class of error as a malformed id: "this id does not
 * resolve to a usable video."
 *
 * @see YouTubeService.fetchMetadata
 * @see VideoSessionExceptionFilter
 */
export class YoutubeVideoNotFoundFailure extends Error {
  readonly youtubeVideoId: string;

  constructor(youtubeVideoId: string) {
    super(`YouTube video "${youtubeVideoId}" was not found.`);
    this.name = 'YoutubeVideoNotFoundFailure';
    this.youtubeVideoId = youtubeVideoId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the YouTube Data API v3 call fails for a reason outside
 * the caller's control (quota exceeded, network error, malformed
 * response).
 *
 * The presentation layer maps this failure to HTTP 502 Bad Gateway via
 * {@link VideoSessionExceptionFilter}: the request was well-formed, but
 * an upstream dependency could not fulfil it.
 *
 * @see YouTubeService.fetchMetadata
 * @see VideoSessionExceptionFilter
 */
export class YoutubeApiUnavailableFailure extends Error {
  constructor(cause: string) {
    super(`YouTube Data API v3 is unavailable: ${cause}`);
    this.name = 'YoutubeApiUnavailableFailure';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a room has no video session yet — no video has ever been
 * added to it via `POST /rooms/:id/video-session`.
 *
 * The presentation layer maps this failure to HTTP 404 Not Found via
 * {@link VideoSessionExceptionFilter}, matching how `RoomExceptionFilter`
 * maps a missing room to 404: from the caller's perspective this is the
 * same class of error as the resource simply not existing yet.
 *
 * @see GET /rooms/:id/video-session
 * @see VideoSessionExceptionFilter
 */
export class VideoSessionNotFoundFailure extends Error {
  readonly roomId: string;

  constructor(roomId: string) {
    super(`Room "${roomId}" has no video session.`);
    this.name = 'VideoSessionNotFoundFailure';
    this.roomId = roomId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the initial `playback_state` write to the Realtime
 * Database cannot be completed (credentials rejected, network error,
 * security rules refusing the write).
 *
 * Mapped to HTTP 502 Bad Gateway via
 * {@link VideoSessionExceptionFilter}, for the same reason as
 * {@link YoutubeApiUnavailableFailure}: the request was well-formed and
 * authorized, but an upstream dependency could not fulfil it.
 *
 * ## Consistency note
 * This failure is raised *after* the `video_sessions` row has been
 * committed to PostgreSQL. The two writes are not transactional and
 * cannot be: one targets a relational database, the other a remote
 * document store.
 *
 * Persist-then-mirror is the deliberate ordering. The reverse would
 * leave a `playback_state` node pointing at a session that does not
 * exist, which every client would happily play. This ordering leaves a
 * persisted session with no real-time node, which the client detects
 * (`GetCurrentPlaybackStateUseCase` fails while
 * `GetVideoSessionUseCase` succeeds) and recovers from by retrying the
 * creation — the node write is idempotent, and `findByRoomId` returns
 * the most recent row, so a replayed creation converges rather than
 * corrupting state.
 *
 * @see FirebaseRealtimeStateService.initialisePlaybackState
 * @see VideoSessionExceptionFilter
 */
export class RealtimeStateUnavailableFailure extends Error {
  constructor(cause: string) {
    super(`The realtime playback state could not be initialised: ${cause}`);
    this.name = 'RealtimeStateUnavailableFailure';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
