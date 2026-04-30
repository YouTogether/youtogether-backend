import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'crypto';

import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';
import { TokenService } from '../../../../src/auth/data/services/token.service';
import { TokenPair } from '../../../../src/auth/domain/value-objects/token-pair.vo';

/**
 * Unit tests for TokenService (B-A01-T3).
 *
 * All external dependencies are mocked:
 * - JwtService.signAsync is stubbed to return a predictable token string.
 * - ConfigService.get is stubbed to return test configuration values.
 *
 * These tests verify:
 * 1. Access token generation with correct payload and expiration.
 * 2. Refresh token generation produces a 64-character hex string.
 * 3. SHA-256 hash computation for refresh token storage.
 * 4. Refresh token verification (match and mismatch).
 * 5. Token pair generation combines both flows.
 *
 * @competency Unit test harness written before production code (TDD).
 * @competency Test scenarios covering nominal and error paths.
 */
describe('TokenService', () => {
  let tokenService: TokenService;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const MOCK_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const MOCK_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue(MOCK_ACCESS_TOKEN),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultValue?: string) => {
                const config: Record<string, string> = {
                  JWT_ACCESS_EXPIRATION: '15m',
                };
                return config[key] ?? defaultValue;
              }),
          },
        },
      ],
    }).compile();

    tokenService = module.get<TokenService>(TokenService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  // ─── Access Token Generation ───────────────────────────────────────

  describe('generateAccessToken', () => {
    it('should sign a JWT with the correct payload containing sub and role', async () => {
      await tokenService.generateAccessToken(MOCK_USER_ID, UserRole.REGISTERED);

      const spy = jest.spyOn(jwtService, 'signAsync');
      expect(spy).toHaveBeenCalledWith(
        { sub: MOCK_USER_ID, role: UserRole.REGISTERED },
        { expiresIn: '15m' },
      );
    });

    it('should return the signed JWT string', async () => {
      const result = await tokenService.generateAccessToken(
        MOCK_USER_ID,
        UserRole.REGISTERED,
      );

      expect(result).toBe(MOCK_ACCESS_TOKEN);
    });

    it('should use the configured expiration from ConfigService', async () => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: string) => {
          if (key === 'JWT_ACCESS_EXPIRATION') return '30m';
          return defaultValue;
        },
      );

      await tokenService.generateAccessToken(MOCK_USER_ID, UserRole.REGISTERED);

      const spy = jest.spyOn(jwtService, 'signAsync');
      expect(spy).toHaveBeenCalledWith(expect.any(Object), {
        expiresIn: '30m',
      });
    });

    it('should default to 15m if JWT_ACCESS_EXPIRATION is not configured', async () => {
      configService.get.mockImplementation(
        (_key: string, defaultValue?: string) => {
          return defaultValue;
        },
      );

      await tokenService.generateAccessToken(MOCK_USER_ID, UserRole.REGISTERED);

      const spy = jest.spyOn(jwtService, 'signAsync');
      expect(spy).toHaveBeenCalledWith(expect.any(Object), {
        expiresIn: '15m',
      });
    });

    it('should embed the guest role when provided', async () => {
      await tokenService.generateAccessToken(MOCK_USER_ID, UserRole.GUEST);

      const spy = jest.spyOn(jwtService, 'signAsync');
      expect(spy).toHaveBeenCalledWith(
        { sub: MOCK_USER_ID, role: UserRole.GUEST },
        expect.any(Object),
      );
    });
  });

  // ─── Refresh Token Generation ──────────────────────────────────────

  describe('generateRefreshToken', () => {
    it('should return a 64-character hex string (32 bytes)', async () => {
      const token = await tokenService.generateRefreshToken();

      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate unique tokens on successive calls', async () => {
      const token1 = await tokenService.generateRefreshToken();
      const token2 = await tokenService.generateRefreshToken();

      expect(token1).not.toBe(token2);
    });
  });

  // ─── Refresh Token Hashing ─────────────────────────────────────────

  describe('hashRefreshToken', () => {
    it('should return the SHA-256 hex digest of the input', () => {
      const input = 'a'.repeat(64);
      const expectedHash = createHash('sha256').update(input).digest('hex');

      const result = tokenService.hashRefreshToken(input);

      expect(result).toBe(expectedHash);
    });

    it('should return a 64-character hex string', () => {
      const result = tokenService.hashRefreshToken('any-token-value');

      expect(result).toHaveLength(64);
      expect(result).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should produce deterministic output for the same input', () => {
      const input = 'deterministic-test-token';
      const hash1 = tokenService.hashRefreshToken(input);
      const hash2 = tokenService.hashRefreshToken(input);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = tokenService.hashRefreshToken('token-a');
      const hash2 = tokenService.hashRefreshToken('token-b');

      expect(hash1).not.toBe(hash2);
    });
  });

  // ─── Refresh Token Verification ────────────────────────────────────

  describe('verifyRefreshToken', () => {
    it('should return true when the token matches the stored hash', () => {
      const token = 'valid-refresh-token';
      const storedHash = createHash('sha256').update(token).digest('hex');

      expect(tokenService.verifyRefreshToken(token, storedHash)).toBe(true);
    });

    it('should return false when the token does not match the stored hash', () => {
      const token = 'presented-token';
      const storedHash = createHash('sha256')
        .update('different-token')
        .digest('hex');

      expect(tokenService.verifyRefreshToken(token, storedHash)).toBe(false);
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

    it('should contain a valid accessToken and refreshToken', async () => {
      const pair = await tokenService.generateTokenPair(
        MOCK_USER_ID,
        UserRole.REGISTERED,
      );

      expect(pair.accessToken).toBe(MOCK_ACCESS_TOKEN);
      expect(pair.refreshToken).toHaveLength(64);
      expect(pair.refreshToken).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should call generateAccessToken with the correct arguments', async () => {
      const spy = jest.spyOn(tokenService, 'generateAccessToken');

      await tokenService.generateTokenPair(MOCK_USER_ID, UserRole.REGISTERED);

      expect(spy).toHaveBeenCalledWith(MOCK_USER_ID, UserRole.REGISTERED);
    });
  });
});
