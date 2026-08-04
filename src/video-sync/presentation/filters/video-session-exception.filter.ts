import {
  ArgumentsHost,
  BadGatewayException,
  BadRequestException,
  Catch,
  ExceptionFilter,
} from '@nestjs/common';
import { Response } from 'express';

import {
  InvalidYoutubeVideoIdFailure,
  YoutubeApiUnavailableFailure,
  YoutubeVideoNotFoundFailure,
} from '../../domain/failures/video-session.failure';

/**
 * Maps Video Synchronisation domain failures to HTTP responses,
 * mirroring `RoomExceptionFilter`.
 *
 * `OwnershipGuard` and room-not-found handling are already covered by
 * `RoomExceptionFilter` (reused as-is on this controller, see
 * `VideoSessionController`) — this filter only needs to cover failures
 * specific to this bounded context.
 */
@Catch(
  InvalidYoutubeVideoIdFailure,
  YoutubeVideoNotFoundFailure,
  YoutubeApiUnavailableFailure,
)
export class VideoSessionExceptionFilter implements ExceptionFilter {
  catch(
    exception:
      | InvalidYoutubeVideoIdFailure
      | YoutubeVideoNotFoundFailure
      | YoutubeApiUnavailableFailure,
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

    const httpException = new BadGatewayException(exception.message);
    response
      .status(httpException.getStatus())
      .json(httpException.getResponse());
  }
}
