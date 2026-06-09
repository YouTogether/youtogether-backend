import { Injectable } from '@nestjs/common';

import { IAuthRepository } from '../repositories/auth-repository.interface';
import { AuthResult } from '../value-objects/auth-result.vo';
import { LoginParams } from './login.params';

/**
 * Use case for user login.
 *
 * Orchestrates the login flow by delegating entirely to {@link IAuthRepository}.
 * Business logic (credential validation, bcrypt comparison, token rotation) is
 * an infrastructure concern implemented in the data layer.
 *
 * @see IAuthRepository.login - the delegated port method
 * @see LoginParams - the input value object
 * @see AuthResult - the output value object
 * @competency Evolvable code via dependency inversion
 */
@Injectable()
export class LoginUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  /**
   * Executes the login use case.
   *
   * @param params - Validated login parameters (email, password).
   * @returns An {@link AuthResult} with the authenticated user and a fresh token pair.
   * @throws {@link InvalidCredentialsFailure} propagated from the repository
   *   when the email is not found or the password does not match.
   */
  async execute(params: LoginParams): Promise<AuthResult> {
    return this.authRepository.login(params);
  }
}
