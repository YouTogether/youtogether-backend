import { UserEntity } from '../entities/user.entity';
import { TokenPair } from './token-pair.vo';

/**
 * Value object returned by {@link RegisterUseCase} on success.
 *
 * Combines the newly created {@link UserEntity} (stripped of sensitive fields)
 * with the {@link TokenPair} issued immediately after registration, allowing
 * the client to authenticate without a subsequent login request.
 */
export class RegisterResult {
  readonly user: UserEntity;
  readonly tokens: TokenPair;

  constructor(params: { user: UserEntity; tokens: TokenPair }) {
    this.user = params.user;
    this.tokens = params.tokens;
  }
}
