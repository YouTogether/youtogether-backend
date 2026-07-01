/**
 * Thrown by the auth repository when a registration attempt uses an email
 * address already associated with an active (non-deleted) user.
 *
 * The presentation layer maps this failure to HTTP 409 Conflict.
 * The domain layer throws it; it never leaks infrastructure details.
 *
 * @see IAuthRepository.register
 * @see DomainExceptionFilter
 */
export class EmailAlreadyInUseFailure extends Error {
  readonly email: string;

  constructor(email: string) {
    super(
      `The email address "${email}" is already in use by an active account.`,
    );
    this.name = 'EmailAlreadyInUseFailure';
    this.email = email;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown by the auth repository when login credentials are invalid.
 *
 * The message is intentionally generic and does not reveal whether the email
 * address exists in the system or whether only the password was incorrect.
 * This prevents user enumeration attacks (OWASP A07:2021).
 *
 * The presentation layer maps this failure to HTTP 401 Unauthorized.
 *
 * @see IAuthRepository.login
 * @see DomainExceptionFilter
 */
export class InvalidCredentialsFailure extends Error {
  constructor() {
    super('Invalid email or password.');
    this.name = 'InvalidCredentialsFailure';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown by the auth repository when a refresh token is invalid, expired,
 * or does not match the stored hash for the associated user.
 *
 * A single failure type covers all three cases (invalid signature, expired,
 * hash mismatch / replay) so the HTTP response never reveals which specific
 * condition triggered it. On a hash mismatch, the repository additionally
 * clears the stored refresh token hash before throwing, invalidating the
 * entire session and forcing the client through a fresh login.
 *
 * The presentation layer maps this failure to HTTP 401 Unauthorized.
 *
 * @see IAuthRepository.refresh
 * @see DomainExceptionFilter
 * @competency Replay detection (B-A03-T1)
 */
export class InvalidRefreshTokenFailure extends Error {
  constructor() {
    super('Invalid or expired refresh token.');
    this.name = 'InvalidRefreshTokenFailure';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown by the auth repository when a cryptographically valid access
 * token's `sub` claim does not resolve to an active (non-deleted) user.
 *
 * This is distinct from an invalid/expired token — the guard already
 * confirmed the token's signature and expiration. This failure covers the
 * narrower window where the account was deleted (or otherwise deactivated)
 * *after* the token was issued but *before* it expired. It is treated as
 * an invalid session rather than a "resource not found" (404): from the
 * client's perspective, the outcome is identical to any other session
 * invalidation, and 401 avoids revealing account-existence information via
 * a different status code.
 *
 * The presentation layer maps this failure to HTTP 401 Unauthorized.
 *
 * @see IAuthRepository.getCurrentUser
 * @see DomainExceptionFilter
 * @competency Session validity beyond token cryptographic checks (B-A05-T1)
 */
export class UserNotFoundFailure extends Error {
  constructor() {
    super('User not found or no longer active.');
    this.name = 'UserNotFoundFailure';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
