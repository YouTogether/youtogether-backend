/**
 * Value object encapsulating the parameter required to refresh a session.
 *
 * Constructed by the presentation layer after DTO validation and passed
 * to {@link RefreshUseCase}.
 *
 * @see RefreshUseCase
 * @see RefreshTokenDto
 */
export class RefreshParams {
  /** The refresh token JWT presented by the client. */
  readonly refreshToken: string;

  constructor(params: { refreshToken: string }) {
    this.refreshToken = params.refreshToken;
  }
}
