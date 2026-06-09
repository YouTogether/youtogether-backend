import { UserEntity } from '../entities/user.entity';
import { TokenPair } from './token-pair.vo';

/**
 * Immutable value object representing the result of any authentication
 * operation that establishes a new session (register, login).
 *
 * Combines the authenticated {@link UserEntity} (stripped of sensitive fields)
 * with the {@link TokenPair} issued by the operation, allowing the client to
 * proceed without an additional round-trip.
 *
 * This value object replaces the previous `RegisterResult` and is now shared
 * by both {@link RegisterUseCase} and {@link LoginUseCase}.
 *
 * @see RegisterUseCase
 * @see LoginUseCase
 */
export class AuthResult {
  readonly user: UserEntity;
  readonly tokens: TokenPair;

  constructor(params: { user: UserEntity; tokens: TokenPair }) {
    this.user = params.user;
    this.tokens = params.tokens;
  }
}
