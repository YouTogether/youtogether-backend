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
  VideoSessionNotFoundFailure,
  YoutubeApiUnavailableFailure,
  YoutubeVideoNotFoundFailure,
} from '../../domain/failures/video-session.failure';

/**
 * Maps Video Synchronisation domain failures to HTTP responses,
 * mirroring `RoomExceptionFilter`.
 *
 * `OwnershipGuard` and a missing *room* are already covered by
 * `RoomExceptionFilter` (reused as-is on this controller, see
 * `VideoSessionController`) — {@link VideoSessionNotFoundFailure} here
 * covers a different case: the room exists, but has no video session
 * yet.
 */
@Catch(
  InvalidYoutubeVideoIdFailure,
  YoutubeVideoNotFoundFailure,
  YoutubeApiUnavailableFailure,
  VideoSessionNotFoundFailure,
)
export class VideoSessionExceptionFilter implements ExceptionFilter {
  catch(
    exception:
      | InvalidYoutubeVideoIdFailure
      | YoutubeVideoNotFoundFailure
      | YoutubeApiUnavailableFailure
      | VideoSessionNotFoundFailure,
    host: ArgumentsHost,
  ): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (
      exception instanceof InvalidYoutubeVideoIdFailure ||
      exception instanceof YoutubeVideoNotFoundFailure
    ) {
      const httpException = new BadRequestException(exception.message);
      response
        .status(httpException.getStatus())
        .json(httpException.getResponse());
      return;
    }

    if (exception instanceof VideoSessionNotFoundFailure) {
      const httpException = new NotFoundException(exception.message);
      response
        .status(httpException.getStatus())
        .json(httpException.getResponse());
      return;
    }

    const httpException = new BadGatewayException(exception.message);
    response
      .status(httpException.getStatus())
      .json(httpException.getResponse());
  }
}
