import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { JwtPayload } from '../../../../src/auth/data/interfaces/jwt-payload.interface';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';
import { JwtStrategy } from '../../../../src/auth/presentation/strategies/jwt.strategy';

/**
 * Unit tests for JwtStrategy (B-A06-T1 — presentation layer).
 *
 * The Passport machinery (signature verification, expiration) is exercised by
 * the parent class and integration tests. These unit tests focus on:
 * - The strategy resolves the secret from ConfigService.
 * - validate() maps the JWT payload to the AuthenticatedUser shape.
 *
 * @competency C2.2.2 — Unit test harness, TDD.
 * @competency C2.3.1 — Test scenarios for token claim mapping.
 */
describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let getOrThrowSpy: jest.Mock;

  beforeEach(async () => {
    getOrThrowSpy = jest
      .fn()
      .mockReturnValue('test-secret-min-32-chars-long!!!');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { getOrThrow: getOrThrowSpy },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should resolve the JWT_SECRET from ConfigService during construction', () => {
    expect(getOrThrowSpy).toHaveBeenCalledWith('JWT_SECRET');
  });

  describe('validate', () => {
    it('should map the payload sub claim to userId', () => {
      const payload: JwtPayload = {
        sub: '550e8400-e29b-41d4-a716-446655440000',
        role: UserRole.REGISTERED,
      };

      const result = strategy.validate(payload);

      expect(result.userId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should map the payload role claim to role', () => {
      const payload: JwtPayload = {
        sub: '550e8400-e29b-41d4-a716-446655440000',
        role: UserRole.REGISTERED,
      };

      const result = strategy.validate(payload);

      expect(result.role).toBe(UserRole.REGISTERED);
    });

    it('should preserve the guest role', () => {
      const payload: JwtPayload = {
        sub: '550e8400-e29b-41d4-a716-446655440000',
        role: UserRole.GUEST,
      };

      const result = strategy.validate(payload);

      expect(result.role).toBe(UserRole.GUEST);
    });

    it('should return only userId and role (no extra fields)', () => {
      const payload: JwtPayload = {
        sub: '550e8400-e29b-41d4-a716-446655440000',
        role: UserRole.REGISTERED,
      };

      const result = strategy.validate(payload);

      expect(Object.keys(result).sort()).toEqual(['role', 'userId']);
    });
  });
});
