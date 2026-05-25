import { UserRole } from '../../domain/enums/user-role.enum';

/**
 * Shape of the authenticated user object attached to the Express request
 * by {@link JwtStrategy.validate}.
 *
 * This is the decoded and validated representation of the JWT access token
 * payload. Protected route handlers access it via the {@link CurrentUser}
 * parameter decorator.
 *
 * It deliberately mirrors the JWT claims (userId, role) rather than the full
 * {@link UserEntity}: the strategy validates the token cryptographically but
 * does not perform a database lookup on every request, keeping protected
 * endpoints fast. Handlers that need the full profile load it explicitly.
 */
export interface AuthenticatedUser {
  /** User UUID, extracted from the JWT `sub` claim. */
  userId: string;

  /** User role, extracted from the JWT `role` claim. */
  role: UserRole;
}
