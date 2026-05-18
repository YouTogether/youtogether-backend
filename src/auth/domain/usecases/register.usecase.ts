import { Injectable } from '@nestjs/common';

import { IAuthRepository } from '../repositories/auth-repository.interface';
import { RegisterParams } from './register.params';
import { RegisterResult } from './register-result.vo';

/**
 * Use case for user registration.
 *
 * Orchestrates the registration flow by delegating to {@link IAuthRepository}.
 * This class contains no business logic beyond delegation — the actual
 * uniqueness check, password hashing, and token generation are infrastructure
 * concerns handled by the data layer implementation.
 *
 * The use case is the single entry point for registration in the domain.
 * All callers (controllers, CLI commands, tests) go through this class,
 * ensuring consistent behavior regardless of the infrastructure in use.
 *
 * @see IAuthRepository.register — the delegated port method
 * @see RegisterParams — the input value object
 * @see RegisterResult — the output value object
 * @competency — Evolvable code via dependency inversion
 */
@Injectable()
export class RegisterUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  /**
   * Executes the registration use case.
   *
   * @param params - Validated registration parameters.
   * @returns A {@link RegisterResult} with the created user and issued tokens.
   * @throws {@link EmailAlreadyInUseFailure} propagated from the repository.
   */
  async execute(params: RegisterParams): Promise<RegisterResult> {
    return this.authRepository.register(params);
  }
}
