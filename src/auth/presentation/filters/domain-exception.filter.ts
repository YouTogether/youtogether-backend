import {
  ArgumentsHost,
  BadGatewayException,
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
import { FirebaseTokenUnavailableFailure } from '../../domain/failures/firebase-token.failure';

/**
 * Exception filter that maps domain failures to appropriate HTTP responses.
 *
 * This filter is the sole crossing point between domain exceptions and HTTP
 * semantics. Domain classes never import HTTP status codes.
 *
 * Mappings:
 * - {@link EmailAlreadyInUseFailure}        -> 409 Conflict
 * - {@link InvalidCredentialsFailure}       -> 401 Unauthorized
 * - {@link InvalidRefreshTokenFailure}      -> 401 Unauthorized
 * - {@link UserNotFoundFailure}             -> 401 Unauthorized
 * - {@link FirebaseTokenUnavailableFailure} -> 502 Bad Gateway
 *
 * Apply this filter at the controller level via @UseFilters(DomainExceptionFilter).
 * New domain failures are registered here as the bounded context grows.
 *
 * ## Why a mapping table rather than a ternary
 * Until now this method read as "conflict for a duplicate email,
 * unauthorized for everything else" — a shape that was correct only for
 * as long as every remaining failure happened to mean 401. Adding
 * {@link FirebaseTokenUnavailableFailure} to `@Catch()` silently mapped
 * a third-party outage to 401, telling clients to re-authenticate over
 * a problem their credentials had nothing to do with.
 *
 * The explicit table below fails loudly instead: a failure listed in
 * `@Catch()` with no branch of its own still falls through to 401, but
 * the union type and this method now name every case, so the omission
 * is visible in review rather than only in production. `RoomExceptionFilter`
 * adopted the same shape for the same reason.
 *
 * @see AuthController
 * @competency Separation of concerns; domain does not depend on HTTP
 */
type AuthDomainFailure =
  | EmailAlreadyInUseFailure
  | InvalidCredentialsFailure
  | InvalidRefreshTokenFailure
  | UserNotFoundFailure
  | FirebaseTokenUnavailableFailure;

@Catch(
  EmailAlreadyInUseFailure,
  InvalidCredentialsFailure,
  InvalidRefreshTokenFailure,
  UserNotFoundFailure,
  FirebaseTokenUnavailableFailure,
)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: AuthDomainFailure, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const httpException = this.toHttpException(exception);

    response
      .status(httpException.getStatus())
      .json(httpException.getResponse());
  }

  private toHttpException(
    exception: AuthDomainFailure,
  ): BadGatewayException | ConflictException | UnauthorizedException {
    if (exception instanceof EmailAlreadyInUseFailure) {
      return new ConflictException(
        `An active account already exists for the email address "${exception.email}".`,
      );
    }

    if (exception instanceof FirebaseTokenUnavailableFailure) {
      // Not 500: nothing in this application is broken. Not 401: the
      // caller's credentials are valid and re-authenticating would not
      // help. Same treatment `VideoSessionExceptionFilter` gives
      // `YoutubeApiUnavailableFailure` — the request was well-formed
      // and authenticated, but an upstream dependency could not fulfil
      // it, and the correct client response is to retry shortly.
      return new BadGatewayException(exception.message);
    }

    // InvalidCredentialsFailure, InvalidRefreshTokenFailure and
    // UserNotFoundFailure all mean "this session is not valid", and
    // deliberately share one status and one message shape so the
    // response never reveals which of the three conditions applied
    // (OWASP A07:2021).
    return new UnauthorizedException(exception.message);
  }
}
