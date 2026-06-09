/**
 * Value object encapsulating the parameters required for user login.
 *
 * Constructed by the presentation layer after DTO validation and passed
 * to {@link LoginUseCase}. Carries no validation logic itself.
 *
 * @see LoginUseCase
 * @see LoginDto
 */
export class LoginParams {
  /** User email address. */
  readonly email: string;

  /** User plaintext password. Never stored; compared against the stored hash. */
  readonly password: string;

  constructor(params: { email: string; password: string }) {
    this.email = params.email;
    this.password = params.password;
  }
}
