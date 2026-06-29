import { Injectable } from '@nestjs/common';

import { IAuthRepository } from '../repositories/auth-repository.interface';
import { AuthResult } from '../value-objects/auth-result.vo';
import { RefreshParams } from './refresh.params';

/**
 * Use case for refreshing an authentication session.
 *
 * Orchestrates the refresh flow by delegating entirely to
 * {@link IAuthRepository}. Token validation, rotation, and replay detection
 * are infrastructure concerns implemented in the data layer.
 *
 * @see IAuthRepository.refresh — the delegated port method
 * @see RefreshParams — the input value object
 * @see AuthResult — the output value object
 * @competency Evolvable code via dependency inversion
 */
@Injectable()
export class RefreshUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  /**
   * Executes the refresh use case.
   *
   * @param params - The presented refresh token.
   * @returns An {@link AuthResult} with the user and a freshly rotated token pair.
   * @throws {@link InvalidRefreshTokenFailure} propagated from the repository
   *   when the token is invalid, expired, or does not match the stored hash.
   */
  async execute(params: RefreshParams): Promise<AuthResult> {
    return this.authRepository.refresh(params);
  }
}
