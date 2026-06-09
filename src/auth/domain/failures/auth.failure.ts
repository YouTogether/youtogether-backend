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
