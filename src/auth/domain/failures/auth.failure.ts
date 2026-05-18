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
