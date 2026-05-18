import { RegisterParams } from '../usecases/register.params';
import { RegisterResult } from '../value-objects/register-result.vo';

/**
 * Repository port for the Authentication bounded context.
 *
 * This abstract class defines the contract that the domain layer depends on.
 * It is implemented by {@link AuthRepositoryImpl} in the data layer, which
 * performs the actual database operations and token generation.
 *
 * Using an abstract class (rather than an interface) allows NestJS dependency
 * injection to use it as a provider token without additional boilerplate.
 *
 * @see AuthRepositoryImpl — data layer implementation
 * @see RegisterUseCase — primary consumer of this port
 */
export abstract class IAuthRepository {
  /**
   * Registers a new user account.
   *
   * Validates email uniqueness among active users, hashes the password,
   * persists the record, and issues a token pair immediately.
   *
   * @param params - Registration input (email, password, username).
   * @returns {@link RegisterResult} containing the new user and token pair.
   * @throws {@link EmailAlreadyInUseFailure} if the email is already registered
   *   by an active (non-deleted) user.
   */
  abstract register(params: RegisterParams): Promise<RegisterResult>;
}
