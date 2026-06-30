import { Injectable } from '@nestjs/common';

import { IAuthRepository } from '../repositories/auth-repository.interface';
import { LogoutParams } from './logout.params';

/**
 * Use case for terminating a user's session server-side.
 *
 * Orchestrates the logout flow by delegating entirely to
 * {@link IAuthRepository}. Clearing the stored refresh token hash is an
 * infrastructure concern implemented in the data layer.
 *
 * Unlike the other auth use cases, this one returns no domain result —
 * logout has no meaningful success payload beyond confirmation.
 *
 * @see IAuthRepository.logout — the delegated port method
 * @see LogoutParams — the input value object
 * @competency Evolvable code via dependency inversion
 */
@Injectable()
export class LogoutUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  /**
   * Executes the logout use case.
   *
   * @param params - The id of the currently authenticated user.
   */
  async execute(params: LogoutParams): Promise<void> {
    return this.authRepository.logout(params);
  }
}
