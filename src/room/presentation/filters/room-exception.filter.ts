import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';

import {
  RoomNotFoundFailure,
  RoomAlreadyJoinedFailure,
  RoomMembershipNotFoundFailure,
  RoomOwnerCannotLeaveFailure,
} from '../../domain/failures/room.failure';

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
 * - {@link RoomMembershipNotFoundFailure} -> 404 Not Found
 * - {@link RoomAlreadyJoinedFailure} -> 409 Conflict
 * - {@link RoomOwnerCannotLeaveFailure} -> 403 Forbidden
 *
 * Apply via `@UseFilters(RoomExceptionFilter)` at the controller level.
 * New Room domain failures are registered here as the
 * bounded context grows, rather than each guard or use case throwing
 * HTTP exceptions of its own. Note that {@link OwnershipGuard}
 * deliberately does *not* go through this filter — see its own
 * documentation for why a pure access-control guard throws directly.
 *
 * @see RoomController
 * @competency Separation of concerns; domain does not depend on HTTP
 */
type RoomDomainFailure =
  | RoomNotFoundFailure
  | RoomMembershipNotFoundFailure
  | RoomAlreadyJoinedFailure
  | RoomOwnerCannotLeaveFailure;

@Catch(
  RoomNotFoundFailure,
  RoomMembershipNotFoundFailure,
  RoomAlreadyJoinedFailure,
  RoomOwnerCannotLeaveFailure,
)
export class RoomExceptionFilter implements ExceptionFilter {
  catch(exception: RoomDomainFailure, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const httpException = this.toHttpException(exception);

    response
      .status(httpException.getStatus())
      .json(httpException.getResponse());
  }

  private toHttpException(
    exception: RoomDomainFailure,
  ): ConflictException | ForbiddenException | NotFoundException {
    if (exception instanceof RoomAlreadyJoinedFailure) {
      return new ConflictException(exception.message);
    }
    if (exception instanceof RoomOwnerCannotLeaveFailure) {
      return new ForbiddenException(exception.message);
    }
    return new NotFoundException(exception.message);
  }
}
