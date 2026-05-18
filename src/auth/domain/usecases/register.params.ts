/**
 * Value object encapsulating the parameters required for user registration.
 *
 * This object is constructed by the presentation layer after DTO validation
 * and passed to {@link RegisterUseCase}. It carries no validation logic
 * itself — validation is enforced at the DTO boundary (class-validator).
 *
 * @see RegisterUseCase
 * @see RegisterDto
 */
export class RegisterParams {
  /** User email address (RFC 5322, max 255 characters). */
  readonly email: string;

  /** User plaintext password (min 8 characters). Hashed by the repository. */
  readonly password: string;

  /** Display name (non-empty, max 50 characters). */
  readonly username: string;

  constructor(params: { email: string; password: string; username: string }) {
    this.email = params.email;
    this.password = params.password;
    this.username = params.username;
  }
}
