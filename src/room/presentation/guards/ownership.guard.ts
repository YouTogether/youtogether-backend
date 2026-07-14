import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';

import { IRoomRepository } from '../../domain/repositories/room-repository.interface';
import { AuthenticatedUser } from '../../../auth/presentation/interfaces/authenticated-user.interface';

/**
 * Guard enforcing that the authenticated user owns the room referenced by
 * the `:id` route parameter.
 *
 * Must be applied **after** {@link JwtAuthGuard} in the guard chain
 * (`@UseGuards(JwtAuthGuard, OwnershipGuard)`), since it reads
 * `request.user` populated by the JWT strategy — mirroring the ordering
 * documented for `CurrentUser`.
 *
 * Reused as-is by every ownership-restricted Room endpoint introduced in
 * Sprint 2: `PATCH /rooms/:id` and `DELETE /rooms/:id`.
 *
 * Deliberately throws `NotFoundException`/`ForbiddenException` directly
 * rather than via a domain failure mapped by an exception filter: unlike
 * `RegisterUseCase`/`AuthRepositoryImpl`, this check is a pure
 * presentation-layer authorization concern with no business logic of its
 * own, so no domain failure type is warranted here — mirroring how
 * `JwtAuthGuard` itself throws `UnauthorizedException` directly via
 * Passport rather than through `DomainExceptionFilter`.
 *
 * @see IRoomRepository.findOwnerId — the delegated lookup
 * @competency Reusable, centralized access control (OWASP A01:2021)
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly roomRepository: IRoomRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request<{ id: string }> & { user: AuthenticatedUser }>();

    const roomId = request.params.id;
    const ownerId = await this.roomRepository.findOwnerId(roomId);

    if (ownerId === null) {
      throw new NotFoundException(`Room with id "${roomId}" was not found.`);
    }

    if (ownerId !== request.user.userId) {
      throw new ForbiddenException(
        'Only the owner of this room may perform this action.',
      );
    }

    return true;
  }
}
