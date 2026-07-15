import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';

import { RoomNotFoundFailure } from '../../domain/failures/room.failure';

/**
 * Exception filter that maps Room domain failures to appropriate HTTP
 * responses, mirroring `DomainExceptionFilter` in the Authentication
 * bounded context.
 *
 * This filter is the sole crossing point between Room domain exceptions
 * and HTTP semantics. Domain classes never import HTTP status codes.
 *
 * Mappings:
 * - {@link RoomNotFoundFailure} -> 404 Not Found
 *
 * Apply via `@UseFilters(RoomExceptionFilter)` at the controller level.
 * New Room domain failures (e.g. for B-R04 through B-R07) are registered
 * here as the bounded context grows, rather than each guard or use case
 * throwing HTTP exceptions to its own. Note that {@link OwnershipGuard}
 * deliberately does *not* go through this filter — see its own
 * documentation for why a pure access-control guard throws directly.
 *
 * @see RoomController
 * @competency Separation of concerns; domain does not depend on HTTP
 */
@Catch(RoomNotFoundFailure)
export class RoomExceptionFilter implements ExceptionFilter {
  catch(exception: RoomNotFoundFailure, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const httpException = new NotFoundException(exception.message);

    response
      .status(httpException.getStatus())
      .json(httpException.getResponse());
  }
}
