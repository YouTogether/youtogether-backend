import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
} from '@nestjs/common';
import { Response } from 'express';

import { EmailAlreadyInUseFailure } from '../../domain/failures/auth.failure';

/**
 * Exception filter that maps domain failures to appropriate HTTP responses.
 *
 * This filter is the sole crossing point between domain exceptions and HTTP
 * semantics. Domain classes never import HTTP status codes; instead, they
 * throw typed failures that this filter translates.
 *
 * Mappings:
 * - {@link EmailAlreadyInUseFailure} → 409 Conflict
 *
 * Apply this filter at the controller or module level. Additional domain
 * failures are registered here as the bounded context grows.
 *
 * @see AuthController
 * @competency Separation of concerns; domain does not depend on HTTP
 */
@Catch(EmailAlreadyInUseFailure)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: EmailAlreadyInUseFailure, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const httpException = new ConflictException(
      `An active account already exists for the email address "${exception.email}".`,
    );

    response
      .status(httpException.getStatus())
      .json(httpException.getResponse());
  }
}
