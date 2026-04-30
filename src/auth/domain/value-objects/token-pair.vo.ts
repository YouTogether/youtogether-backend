/**
 * Immutable value object representing a pair of authentication tokens.
 *
 * Returned by authentication use cases (register, login, refresh) to
 * provide the client with both an access token and a refresh token.
 *
 * - `accessToken`: Short-lived JWT carrying userId and role claims.
 * - `refreshToken`: Long-lived opaque token used to obtain new access tokens.
 *
 * This value object belongs to the domain layer and carries no infrastructure
 * concern. The actual token generation mechanism is an implementation detail
 * of the data layer ({@link TokenService}).
 *
 * @see Data Model Specification §2.1.1 — refresh_token_hash column
 */
export class TokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;

  constructor(params: { accessToken: string; refreshToken: string }) {
    this.accessToken = params.accessToken;
    this.refreshToken = params.refreshToken;
  }
}
