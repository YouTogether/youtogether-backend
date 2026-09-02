import {
  ArgumentsHost,
  BadGatewayException,
  BadRequestException,
  Catch,
  ExceptionFilter,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';

import {
  InvalidYoutubeVideoIdFailure,
  RealtimeStateUnavailableFailure,
  VideoSessionNotFoundFailure,
  YoutubeApiUnavailableFailure,
  YoutubeVideoNotFoundFailure,
} from '../../domain/failures/video-session.failure';

/**
 * Maps Video Synchronisation domain failures to HTTP responses, mirroring
 * `DomainExceptionFilter`.
 *
 * `OwnershipGuard` and a missing *room* are already covered by
 * `RoomExceptionFilter` (reused as-is on this controller, see
 * `VideoSessionController`) — {@link VideoSessionNotFoundFailure} here
 * covers a different case: the room exists, but has no video session
 * yet.
 *
 * Mappings:
 * - {@link InvalidYoutubeVideoIdFailure}    -> 400 Bad Request
 * - {@link YoutubeVideoNotFoundFailure}     -> 400 Bad Request
 * - {@link VideoSessionNotFoundFailure}     -> 404 Not Found
 * - {@link YoutubeApiUnavailableFailure}    -> 502 Bad Gateway
 * - {@link RealtimeStateUnavailableFailure} -> 502 Bad Gateway
 *
 * ## Why a mapping table rather than a trailing catch-all
 * The previous shape read as "400 for the two id failures, 404 for a
 * missing session, everything else falls through to 502" — correct
 * only for as long as every failure ever added to `@Catch()` happened
 * to mean 502. `DomainExceptionFilter` carried the equivalent shape
 * with 401 as its silent default, and adding
 * `FirebaseTokenUnavailableFailure` there without a dedicated branch
 * mapped a 502-shaped failure to 401 unnoticed — caught only because a
 * new test exercised the filter directly rather than asserting on a
 * `BadGatewayException` built by hand.
 *
 * This filter had no such bug: both failures reaching its implicit
 * default (`YoutubeApiUnavailableFailure`,
 * `RealtimeStateUnavailableFailure`) do belong at 502. But that was a
 * coincidence of content, not a guarantee of structure — a future
 * failure added to `@Catch()` without a branch of its own would have
 * landed at 502 by the same silent default, whether or not 502 was
 * correct for it. The explicit table below removes the coincidence:
 * every case is named, and an unnamed one is a compile-time gap in the
 * `switch`, not a runtime surprise.
 *
 * @see VideoSessionController
 * @competency Separation of concerns; domain does not depend on HTTP
 */
type VideoSessionDomainFailure =
  | InvalidYoutubeVideoIdFailure
  | YoutubeVideoNotFoundFailure
  | VideoSessionNotFoundFailure
  | YoutubeApiUnavailableFailure
  | RealtimeStateUnavailableFailure;

@Catch(
  InvalidYoutubeVideoIdFailure,
  YoutubeVideoNotFoundFailure,
  VideoSessionNotFoundFailure,
  YoutubeApiUnavailableFailure,
  RealtimeStateUnavailableFailure,
)
export class VideoSessionExceptionFilter implements ExceptionFilter {
  catch(exception: VideoSessionDomainFailure, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    const httpException = this.toHttpException(exception);

    response
      .status(httpException.getStatus())
      .json(httpException.getResponse());
  }

  private toHttpException(
    exception: VideoSessionDomainFailure,
  ): BadGatewayException | BadRequestException | NotFoundException {
    switch (true) {
      case exception instanceof InvalidYoutubeVideoIdFailure:
      case exception instanceof YoutubeVideoNotFoundFailure:
        // Same status for both: from the caller's perspective this is
        // one class of error — "this id does not resolve to a usable
        // video" — whether the id was malformed or merely unknown to
        // YouTube.
        return new BadRequestException(exception.message);

      case exception instanceof VideoSessionNotFoundFailure:
        return new NotFoundException(exception.message);

      case exception instanceof YoutubeApiUnavailableFailure:
      case exception instanceof RealtimeStateUnavailableFailure:
        // Both mean "the request was well formed and authorised, but
        // an upstream dependency could not fulfil it" — the YouTube
        // Data API in one case, the Realtime Database write in the
        // other (B-V03). The client's recovery is the same either way:
        // retry the creation.
        return new BadGatewayException(exception.message);

      default:
        // Unreachable given VideoSessionDomainFailure and @Catch()
        // above stay in sync — a mismatch between the two is exactly
        // what this filter's own spec checks for directly. Kept,
        // rather than omitted, purely to satisfy TypeScript's
        // control-flow analysis: a `switch(true)` over `instanceof`
        // guards is not recognized as exhaustive even when the union
        // is.
        return new BadGatewayException(
          (exception as Error).message ?? 'Unhandled video session failure.',
        );
    }
  }
}
