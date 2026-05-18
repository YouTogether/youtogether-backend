import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { StringValue } from 'ms';

import { UserRole } from '../../domain/enums/user-role.enum';
import { TokenPair } from '../../domain/value-objects/token-pair.vo';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Service responsible for JWT token lifecycle management.
 *
 * This service belongs to the data layer because it depends on infrastructure
 * libraries (`@nestjs/jwt`, Node.js `crypto`). Domain use cases interact with
 * tokens exclusively through the {@link TokenPair} value object returned by
 * the repository — they never call this service directly.
 *
 * Responsibilities:
 * - Generate short-lived JWT access tokens (userId + role in payload).
 * - Generate long-lived opaque refresh tokens (cryptographically random).
 * - Compute SHA-256 hashes for refresh token storage (never store plaintext).
 * - Verify a presented refresh token against its stored hash.
 *
 * Configuration (via environment variables):
 * - `JWT_SECRET`: HMAC secret for access token signing.
 * - `JWT_ACCESS_EXPIRATION`: Access token TTL (default: '15m').
 *
 * @competency Secure token generation with rotation support
 */
@Injectable()
export class TokenService {
  /** Length in bytes for the opaque refresh token (64 hex characters). */
  private static readonly REFRESH_TOKEN_BYTES = 32;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generates a token pair (access + refresh) for the given user.
   *
   * Returns a domain {@link TokenPair} value object, decoupling the
   * caller from the JWT implementation detail.
   *
   * @param userId - UUID of the authenticated user.
   * @param role - User role to embed in the access token payload.
   * @returns A {@link TokenPair} containing both tokens as strings.
   */
  async generateTokenPair(userId: string, role: UserRole): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(userId, role),
      this.generateRefreshToken(),
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
   * Generates a cryptographically secure opaque refresh token.
   *
   * The token is a random hex string (64 characters / 32 bytes). It is NOT
   * a JWT — this avoids exposing claims in a long-lived token and simplifies
   * revocation (just clear the hash in the database).
   *
   * @returns Opaque refresh token as a hex string.
   */
  async generateRefreshToken(): Promise<string> {
    return Promise.resolve(
      randomBytes(TokenService.REFRESH_TOKEN_BYTES).toString('hex'),
    );
  }

  /**
   * Computes the SHA-256 hash of a refresh token for database storage.
   *
   * Only the hash is persisted; the plaintext token is returned to the client
   * exactly once and never stored server-side.
   *
   * @param refreshToken - The plaintext refresh token.
   * @returns SHA-256 hex digest (64 characters).
   */
  hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  /**
   * Verifies whether a plaintext refresh token matches its stored hash.
   *
   * Used during the token refresh flow to validate the presented token
   * against the hash in `users.refresh_token_hash`. A mismatch indicates
   * either an expired rotation or a replay attack.
   *
   * @param refreshToken - The plaintext refresh token presented by the client.
   * @param storedHash - The SHA-256 hash stored in the database.
   * @returns `true` if the token matches, `false` otherwise.
   */
  verifyRefreshToken(refreshToken: string, storedHash: string): boolean {
    const computedHash = this.hashRefreshToken(refreshToken);
    return computedHash === storedHash;
  }
}
