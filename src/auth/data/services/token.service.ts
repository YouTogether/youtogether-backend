import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'crypto';
import { StringValue } from 'ms';

import { UserRole } from '../../domain/enums/user-role.enum';
import { TokenPair } from '../../domain/value-objects/token-pair.vo';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { JwtRefreshPayload } from '../interfaces/jwt-refresh-payload.interface';

/**
 * Service responsible for JWT token lifecycle management.
 *
 * Access tokens are short-lived JWTs signed via the NestJS {@link JwtService},
 * using `JWT_SECRET`. Refresh tokens are ALSO JWTs (revised in B-A03-T1 from
 * the original opaque-token design — see the class-level note below), signed
 * directly via the `jsonwebtoken` library using a distinct secret,
 * `JWT_REFRESH_SECRET`.
 *
 * Responsibilities:
 * - Generate short-lived JWT access tokens (userId + role in payload).
 * - Generate long-lived JWT refresh tokens.
 * - Compute SHA-256 hashes for refresh token storage (never store plaintext).
 * - Verify a presented refresh token against its stored hash.
 *
 * Configuration (via environment variables):
 * - `JWT_SECRET`: HMAC secret for access token signing.
 * - `JWT_ACCESS_EXPIRATION`: Access token TTL (default: '15m').
 * - `JWT_REFRESH_SECRET`: HMAC secret for refresh token signing (required,
 *   must differ from JWT_SECRET).
 * - `JWT_REFRESH_EXPIRATION`: Refresh token TTL (default: '7d').
 *
 * @competency Secure token generation with rotation support
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generates a token pair (access + refresh) for the given user.
   *
   * @param userId - UUID of the authenticated user.
   * @param role - User role to embed in the access token payload.
   * @returns A {@link TokenPair} containing both tokens as strings.
   */
  async generateTokenPair(userId: string, role: UserRole): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(userId, role),
      this.generateRefreshToken(userId),
    ]);

    return new TokenPair({ accessToken, refreshToken });
  }

  /**
   * Generates a signed JWT access token.
   *
   * The token contains the user ID as the `sub` claim and the role for
   * authorization. Expiration is configurable via `JWT_ACCESS_EXPIRATION`.
   *
   * @param userId - UUID of the authenticated user.
   * @param role - User role claim.
   * @returns Signed JWT string.
   */
  async generateAccessToken(userId: string, role: UserRole): Promise<string> {
    const payload: JwtPayload = { sub: userId, role };
    const expiresIn = this.configService.get<string>(
      'JWT_ACCESS_EXPIRATION',
      '15m',
    ) as StringValue;

    return Promise.resolve(this.jwtService.signAsync(payload, { expiresIn }));
  }

  /**
   * Generates a signed JWT refresh token.
   *
   * The token carries only `sub` (user id) and `type: 'refresh'`. It is
   * signed with `JWT_REFRESH_SECRET`, distinct from the access token secret,
   * and expires after `JWT_REFRESH_EXPIRATION` (default 7 days).
   *
   * @param userId - UUID of the authenticated user.
   * @returns Signed refresh token JWT string.
   */
  async generateRefreshToken(userId: string): Promise<string> {
    const payload: JwtRefreshPayload = {
      sub: userId,
      type: 'refresh',
      jti: randomUUID(),
    };
    const secret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const expiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRATION',
      '7d',
    );

    return this.jwtService.signAsync(payload, {
      secret,
      expiresIn: expiresIn as never,
    });
  }

  /**
   * Verifies the signature and expiration of a refresh token and decodes
   * its payload.
   *
   * Throws synchronously if:
   * - The signature does not match `JWT_REFRESH_SECRET`.
   * - The token has expired.
   * - The decoded payload's `type` claim is not `'refresh'` (rejects an
   *   access token presented as a refresh token).
   *
   * This method only proves the token was issued by this server and has not
   * expired. It does NOT prove the token is still the active session token —
   * that requires comparing its hash against the stored value, performed
   * separately by the repository.
   *
   * @param token - The refresh token JWT presented by the client.
   * @returns The decoded {@link JwtRefreshPayload}.
   * @throws on any validation failure (invalid signature, expired, wrong type).
   */
  verifyAndDecodeRefreshToken(token: string): JwtRefreshPayload {
    const secret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const decoded = this.jwtService.verify<
      JwtRefreshPayload & Record<string, unknown>
    >(token, { secret });

    if (decoded.type !== 'refresh') {
      throw new Error('Token is not a refresh token.');
    }

    return { sub: decoded.sub, type: 'refresh' };
  }

  /**
   * Computes the SHA-256 hash of a refresh token for database storage.
   *
   * Only the hash is persisted; the plaintext token is returned to the
   * client exactly once and never stored server-side.
   *
   * @param refreshToken - The plaintext (JWT) refresh token.
   * @returns SHA-256 hex digest (64 characters).
   */
  hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  /**
   * Checks whether a presented refresh token's hash matches the stored hash.
   *
   * Used during the refresh flow for rotation/replay detection: a presented
   * token may be cryptographically valid (correct signature, not expired)
   * yet still rejected if it no longer matches the stored hash — the case
   * for a previously-rotated (already-used) refresh token.
   *
   * @param refreshToken - The plaintext refresh token presented by the client.
   * @param storedHash - The SHA-256 hash stored in the database.
   * @returns `true` if the token matches, `false` otherwise.
   */
  verifyRefreshToken(refreshToken: string, storedHash: string): boolean {
    return this.hashRefreshToken(refreshToken) === storedHash;
  }
}
