import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';

import {
  EmailAlreadyInUseFailure,
  InvalidCredentialsFailure,
  InvalidRefreshTokenFailure,
  UserNotFoundFailure,
} from '../../domain/failures/auth.failure';

/**
 * Exception filter that maps domain failures to appropriate HTTP responses.
 *
 * This filter is the sole crossing point between domain exceptions and HTTP
 * semantics. Domain classes never import HTTP status codes.
 *
 * Mappings:
 * - {@link EmailAlreadyInUseFailure}   -> 409 Conflict
 * - {@link InvalidCredentialsFailure}  -> 401 Unauthorized
 * - {@link InvalidRefreshTokenFailure} -> 401 Unauthorized
 * - {@link UserNotFoundFailure}        -> 401 Unauthorized
 *
 * Apply this filter at the controller level via @UseFilters(DomainExceptionFilter).
 * New domain failures are registered here as the bounded context grows.
 *
 * @see AuthController
 * @competency Separation of concerns; domain does not depend on HTTP
 */
@Catch(
  EmailAlreadyInUseFailure,
  InvalidCredentialsFailure,
  InvalidRefreshTokenFailure,
  UserNotFoundFailure,
)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(
    exception:
      | EmailAlreadyInUseFailure
      | InvalidCredentialsFailure
      | InvalidRefreshTokenFailure
      | UserNotFoundFailure,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const httpException =
      exception instanceof EmailAlreadyInUseFailure
        ? new ConflictException(
            `An active account already exists for the email address "${exception.email}".`,
          )
        : new UnauthorizedException(exception.message);

    response
      .status(httpException.getStatus())
      .json(httpException.getResponse());
  }
}
