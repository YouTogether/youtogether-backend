import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'crypto';

import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';
import { TokenService } from '../../../../src/auth/data/services/token.service';
import { TokenPair } from '../../../../src/auth/domain/value-objects/token-pair.vo';

/**
 * Unit tests for TokenService.
 *
 * Both access and refresh tokens are signed/verified through a REAL
 * JwtService instance (provided via JwtModule.register), rather than a
 * handwritten mock. TokenService now routes 100% of its cryptographic
 * operations through JwtService, so testing against the real
 * implementation exercises the actual sign/verify behavior (expiration,
 * signature mismatch, payload integrity) without needing a second mocking
 * strategy for the refresh-token path.
 *
 * These tests verify:
 * 1. Access token generation with correct payload and expiration.
 * 2. Refresh token generation produces a JWT with correct payload and expiration.
 * 3. SHA-256 hash computation for refresh token storage.
 * 4. Refresh token verification (match and mismatch).
 * 5. Token pair generation combines both flows.
 *
 * @competency Unit test harness written before production code (TDD).
 * @competency Test scenarios covering nominal and error paths.
 */
describe('TokenService', () => {
  let tokenService: TokenService;
  let jwtService: JwtService;
  let configService: jest.Mocked<ConfigService>;

  const MOCK_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const ACCESS_SECRET =
    'fad88969cbab1e29152e2ebab6306a61fb2a07f4ec662938f57988d030c7cb3c02db9dac544d65faa5efdf6d130c3c41';
  const REFRESH_SECRET =
    'e675b2f9affdf3609e857294d44289bf4550c658e214dfab162d9f227e087e507b099101d302aeb480003e94527048dd';

  const CONFIG_VALUES: Record<string, string> = {
    JWT_ACCESS_EXPIRATION: '15m',
    JWT_REFRESH_SECRET: REFRESH_SECRET,
    JWT_REFRESH_EXPIRATION: '7d',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: ACCESS_SECRET })],
      providers: [
        TokenService,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultValue?: string) => {
                return CONFIG_VALUES[key] ?? defaultValue;
              }),
            getOrThrow: jest.fn().mockImplementation((key: string) => {
              const value = CONFIG_VALUES[key];
              if (value === undefined) {
                throw new Error(`Missing config: ${key}`);
              }
              return value;
            }),
          },
        },
      ],
    }).compile();

    tokenService = module.get<TokenService>(TokenService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get(ConfigService);
  });

  // ─── Access Token Generation ───────────────────────────────────────

  describe('generateAccessToken', () => {
    it('should call JwtService.signAsync with the correct payload and expiresIn', async () => {
      const signAsyncSpy = jest.spyOn(jwtService, 'signAsync');

      await tokenService.generateAccessToken(MOCK_USER_ID, UserRole.REGISTERED);

      expect(signAsyncSpy).toHaveBeenCalledWith(
        { sub: MOCK_USER_ID, role: UserRole.REGISTERED },
        { expiresIn: '15m' },
      );
    });

    it('should return a real, verifiable three-part JWT', async () => {
      const token = await tokenService.generateAccessToken(
        MOCK_USER_ID,
        UserRole.REGISTERED,
      );

      expect(token.split('.')).toHaveLength(3);
      const decoded = jwtService.verify<{ sub: string; role: UserRole }>(
        token,
        { secret: ACCESS_SECRET },
      );
      expect(decoded).toMatchObject({
        sub: MOCK_USER_ID,
        role: UserRole.REGISTERED,
      });
    });

    it('should use the configured expiration from ConfigService', async () => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'JWT_ACCESS_EXPIRATION') return '30m';
          return CONFIG_VALUES[key] ?? defaultValue;
        },
      );
      const signAsyncSpy = jest.spyOn(jwtService, 'signAsync');

      await tokenService.generateAccessToken(MOCK_USER_ID, UserRole.REGISTERED);

      expect(signAsyncSpy).toHaveBeenCalledWith(expect.any(Object), {
        expiresIn: '30m',
      });
    });
  });

  // ─── Refresh Token Generation ──────────────────────────────────────

  describe('generateRefreshToken', () => {
    it('should call JwtService.signAsync with sub, type, and the refresh secret/expiration', async () => {
      const signAsyncSpy = jest.spyOn(jwtService, 'signAsync');

      await tokenService.generateRefreshToken(MOCK_USER_ID);

      expect(signAsyncSpy).toHaveBeenCalledWith(
        expect.objectContaining({ sub: MOCK_USER_ID, type: 'refresh' }),
        { secret: REFRESH_SECRET, expiresIn: '7d' },
      );
    });

    it('should return a three-part JWT signed with JWT_REFRESH_SECRET', async () => {
      const token = await tokenService.generateRefreshToken(MOCK_USER_ID);

      expect(token.split('.')).toHaveLength(3);
      expect(() => {
        jwtService.verify(token, { secret: REFRESH_SECRET });
      }).not.toThrow();
    });

    it('should NOT be verifiable with the access token secret', async () => {
      const token = await tokenService.generateRefreshToken(MOCK_USER_ID);

      expect(() => {
        jwtService.verify(token, { secret: ACCESS_SECRET });
      }).toThrow();
    });

    it('should throw if JWT_REFRESH_SECRET is not configured', async () => {
      configService.getOrThrow.mockImplementation((key: string) => {
        throw new Error(`Missing config: ${key}`);
      });

      await expect(
        tokenService.generateRefreshToken(MOCK_USER_ID),
      ).rejects.toThrow('Missing config: JWT_REFRESH_SECRET');
    });
  });

  // ─── Refresh Token Verification ─────────────────────────────────────

  describe('verifyAndDecodeRefreshToken', () => {
    it('should decode a valid token issued by generateRefreshToken', async () => {
      const token = await tokenService.generateRefreshToken(MOCK_USER_ID);

      const payload = tokenService.verifyAndDecodeRefreshToken(token);

      expect(payload).toEqual({ sub: MOCK_USER_ID, type: 'refresh' });
    });

    it('should throw when the token signature does not match the configured secret', () => {
      const tokenSignedWithWrongSecret = jwtService.sign(
        { sub: MOCK_USER_ID, type: 'refresh' },
        { secret: 'a-completely-different-secret', expiresIn: '7d' },
      );

      expect(() =>
        tokenService.verifyAndDecodeRefreshToken(tokenSignedWithWrongSecret),
      ).toThrow();
    });

    it('should throw when the token has expired', () => {
      const expiredToken = jwtService.sign(
        {
          sub: MOCK_USER_ID,
          type: 'refresh',
          exp: Math.floor(Date.now() / 1000) - 10,
        },
        { secret: REFRESH_SECRET },
      );

      expect(() =>
        tokenService.verifyAndDecodeRefreshToken(expiredToken),
      ).toThrow();
    });

    it('should throw when the type claim is not "refresh" (type confusion)', () => {
      const accessLikeToken = jwtService.sign(
        { sub: MOCK_USER_ID, role: UserRole.REGISTERED },
        { secret: REFRESH_SECRET, expiresIn: '15m' },
      );

      expect(() =>
        tokenService.verifyAndDecodeRefreshToken(accessLikeToken),
      ).toThrow('Token is not a refresh token.');
    });

    it('should throw on a malformed token string', () => {
      expect(() =>
        tokenService.verifyAndDecodeRefreshToken('not-a-jwt-at-all'),
      ).toThrow();
    });
  });

  // ─── Refresh Token Hashing (unchanged behaviour) ───────────────────

  describe('hashRefreshToken', () => {
    it('should return the SHA-256 hex digest of the input', () => {
      const input = 'a'.repeat(64);
      const expectedHash = createHash('sha256').update(input).digest('hex');

      expect(tokenService.hashRefreshToken(input)).toBe(expectedHash);
    });

    it('should produce deterministic output for the same input', () => {
      const input = 'deterministic-test-token';
      expect(tokenService.hashRefreshToken(input)).toBe(
        tokenService.hashRefreshToken(input),
      );
    });

    it('should produce different hashes for different inputs', () => {
      expect(tokenService.hashRefreshToken('token-a')).not.toBe(
        tokenService.hashRefreshToken('token-b'),
      );
    });
  });

  // ─── Refresh Token Verification ────────────────────────────────────

  describe('verifyRefreshToken (hash match check)', () => {
    it('should return true when the token matches the stored hash', () => {
      const token = 'some-refresh-jwt';
      const storedHash = createHash('sha256').update(token).digest('hex');

      expect(tokenService.verifyRefreshToken(token, storedHash)).toBe(true);
    });

    it('should return false when the token does not match the stored hash', () => {
      const storedHash = createHash('sha256')
        .update('a-different-token')
        .digest('hex');

      expect(
        tokenService.verifyRefreshToken('some-refresh-jwt', storedHash),
      ).toBe(false);
    });

    it('should return false when the stored hash is an empty string', () => {
      expect(tokenService.verifyRefreshToken('any-token', '')).toBe(false);
    });
  });

  // ─── Token Pair Generation ─────────────────────────────────────────

  describe('generateTokenPair', () => {
    it('should return a TokenPair domain value object', async () => {
      const pair = await tokenService.generateTokenPair(
        MOCK_USER_ID,
        UserRole.REGISTERED,
      );

      expect(pair).toBeInstanceOf(TokenPair);
    });

    it('should produce an accessToken verifiable with the access secret', async () => {
      const pair = await tokenService.generateTokenPair(
        MOCK_USER_ID,
        UserRole.REGISTERED,
      );

      expect(() => {
        jwtService.verify(pair.accessToken, { secret: ACCESS_SECRET });
      }).not.toThrow();
    });

    it('should produce a refreshToken that decodes to the same userId', async () => {
      const pair = await tokenService.generateTokenPair(
        MOCK_USER_ID,
        UserRole.REGISTERED,
      );

      const payload = tokenService.verifyAndDecodeRefreshToken(
        pair.refreshToken,
      );
      expect(payload.sub).toBe(MOCK_USER_ID);
    });

    it('should call generateRefreshToken with the provided userId', async () => {
      const spy = jest.spyOn(tokenService, 'generateRefreshToken');

      await tokenService.generateTokenPair(MOCK_USER_ID, UserRole.REGISTERED);

      expect(spy).toHaveBeenCalledWith(MOCK_USER_ID);
    });
  });
});
