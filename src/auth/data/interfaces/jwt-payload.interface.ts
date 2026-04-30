import { UserRole } from '../../domain/enums/user-role.enum';

/**
 * Payload embedded in JWT access tokens.
 *
 * This interface is an implementation detail of the data layer. It defines
 * the claims that {@link TokenService} signs into access tokens and that
 * {@link JwtStrategy} extracts upon verification.
 *
 * Domain code does not depend on this interface — it receives a
 * {@link TokenPair} value object from the repository, abstracting away
 * the JWT structure.
 */
export interface JwtPayload {
  /** User UUID (JWT `sub` claim). */
  sub: string;

  /** User role for authorization decisions. */
  role: UserRole;
}
