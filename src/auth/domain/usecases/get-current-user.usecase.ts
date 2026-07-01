import { Injectable } from '@nestjs/common';

import { UserEntity } from '../entities/user.entity';
import { IAuthRepository } from '../repositories/auth-repository.interface';
import { GetCurrentUserParams } from './get-current-user.params';

/**
 * Use case for retrieving the currently authenticated user's profile.
 *
 * Orchestrates the flow by delegating entirely to {@link IAuthRepository}.
 * Unlike {@link JwtStrategy.validate}, which trusts the token's claims
 * without a database round-trip, this use case performs a fresh lookup —
 * it is the mechanism by which the frontend confirms a cached session is
 * still valid against the current state of the user's account (e.g. not
 * soft-deleted since the token was issued).
 *
 * @see IAuthRepository.getCurrentUser — the delegated port method
 * @see GetCurrentUserParams — the input value object
 * @competency Evolvable code via dependency inversion
 */
@Injectable()
export class GetCurrentUserUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  /**
   * Executes the get-current-user use case.
   *
   * @param params - The id of the currently authenticated user.
   * @returns The {@link UserEntity} for the authenticated user.
   * @throws {@link UserNotFoundFailure} propagated from the repository when
   *   no active user matches the id (e.g. soft-deleted after token issuance).
   */
  async execute(params: GetCurrentUserParams): Promise<UserEntity> {
    return this.authRepository.getCurrentUser(params);
  }
}
