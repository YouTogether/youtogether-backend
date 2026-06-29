/**
 * Payload embedded in refresh token JWTs.
 *
 * Unlike the access token payload, this carries only the user identifier
 * and a `type` discriminator. The discriminator prevents an access token
 * from being presented as a refresh token (type confusion attack): the
 * verification step in {@link TokenService.verifyAndDecodeRefreshToken}
 * rejects any decoded payload where `type !== 'refresh'`.
 *
 * The refresh token is signed with a secret distinct from the access token
 * (`JWT_REFRESH_SECRET`), so that leaking one secret does not allow forging
 * the other token type.
 */
export interface JwtRefreshPayload {
  /** User UUID (JWT `sub` claim). */
  sub: string;

  /** Discriminator preventing access/refresh token confusion. */
  type: 'refresh';
}
