import { RegisterParams } from '../usecases/register.params';
import { RefreshParams } from '../usecases/refresh.params';
import { LoginParams } from '../usecases/login.params';
import { AuthResult } from '../value-objects/auth-result.vo';

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
   * @returns {@link AuthResult} containing the new user and token pair.
   * @throws {@link EmailAlreadyInUseFailure} if the email is already registered
   *   by an active (non-deleted) user.
   */
  abstract register(params: RegisterParams): Promise<AuthResult>;

  /**
   * Authenticates a user with email and password.
   *
   * Looks up the user by email among active (non-deleted) users, compares
   * the plaintext password against the stored bcrypt hash, issues a new
   * token pair on success, and stores the refresh token hash.
   *
   * The error message on failure is intentionally generic to prevent user
   * enumeration (OWASP A07:2021).
   *
   * @param params - Login input (email, password).
   * @returns {@link AuthResult} containing the authenticated user and a fresh token pair.
   * @throws {@link InvalidCredentialsFailure} when the email is not found
   *   or the password does not match. The same failure is used in both cases.
   */
  abstract login(params: LoginParams): Promise<AuthResult>;

  /**
   * Rotates a session using a previously issued refresh token.
   *
   * Validates the token's signature and expiration, resolves the associated
   * user from its `sub` claim, and compares the token's hash against the
   * stored `refresh_token_hash`. On a match, issues a new token pair
   * (rotation) and overwrites the stored hash, invalidating the presented
   * token for any future use. On a hash mismatch (replay of an
   * already-rotated token), the stored hash is cleared entirely, forcing
   * re-authentication for the whole session.
   *
   * @param params - The presented refresh token.
   * @returns {@link AuthResult} containing the user and a freshly rotated token pair.
   * @throws {@link InvalidRefreshTokenFailure} when the token is invalid,
   *   expired, belongs to a deleted/unknown user, or does not match the
   *   stored hash.
   */
  abstract refresh(params: RefreshParams): Promise<AuthResult>;
}
