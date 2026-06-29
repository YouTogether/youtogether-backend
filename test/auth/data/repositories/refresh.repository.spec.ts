import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { IsNull, Repository } from 'typeorm';

import { AuthRepositoryImpl } from '../../../../src/auth/data/repositories/auth-repository.impl';
import { UserOrmEntity } from '../../../../src/auth/data/entities/user.orm-entity';
import { TokenService } from '../../../../src/auth/data/services/token.service';
import { InvalidRefreshTokenFailure } from '../../../../src/auth/domain/failures/auth.failure';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';
import { TokenPair } from '../../../../src/auth/domain/value-objects/token-pair.vo';
import { AuthResult } from '../../../../src/auth/domain/value-objects/auth-result.vo';
import { RefreshParams } from '../../../../src/auth/domain/usecases/refresh.params';

/**
 * Unit tests for AuthRepositoryImpl.refresh().
 *
 * Covers:
 * - Successful rotation: valid token, matching hash, new pair issued.
 * - Invalid signature / expired token: verifyAndDecodeRefreshToken throws.
 * - Unknown or soft-deleted user (sub does not resolve to an active user).
 * - No active session (refreshTokenHash is null — e.g. after logout).
 * - Replay detection: hash mismatch clears the stored hash and rejects.
 *
 * @competency Unit test harness, TDD.
 * @competency Scenarios matching the acceptance criteria.
 */
describe('AuthRepositoryImpl — refresh()', () => {
  let authRepository: AuthRepositoryImpl;
  let userTypeOrmRepository: jest.Mocked<Repository<UserOrmEntity>>;
  let tokenService: jest.Mocked<TokenService>;

  const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const PRESENTED_TOKEN = 'presented-refresh-jwt';
  const VALID_PARAMS = new RefreshParams({ refreshToken: PRESENTED_TOKEN });

  const buildOrmUser = (
    overrides: Partial<UserOrmEntity> = {},
  ): UserOrmEntity => {
    const orm = new UserOrmEntity();
    orm.id = USER_ID;
    orm.email = 'existing@example.com';
    orm.passwordHash = '$2b$12$validhashedpassword.stored.in.db.xxxx';
    orm.username = 'existinguser';
    orm.role = UserRole.REGISTERED;
    orm.refreshTokenHash = 'stored-hash-of-current-token';
    orm.createdAt = new Date('2025-01-01T00:00:00Z');
    orm.updatedAt = new Date('2025-01-01T00:00:00Z');
    orm.deletedAt = null;
    return Object.assign(orm, overrides);
  };

  const NEW_TOKENS = new TokenPair({
    accessToken: 'new.access.token',
    refreshToken: 'new-refresh-jwt',
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthRepositoryImpl,
        {
          provide: getRepositoryToken(UserOrmEntity),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            verifyAndDecodeRefreshToken: jest.fn(),
            verifyRefreshToken: jest.fn(),
            generateTokenPair: jest.fn().mockResolvedValue(NEW_TOKENS),
            hashRefreshToken: jest.fn().mockReturnValue('new-stored-hash'),
          },
        },
      ],
    }).compile();

    authRepository = module.get<AuthRepositoryImpl>(AuthRepositoryImpl);
    userTypeOrmRepository = module.get(getRepositoryToken(UserOrmEntity));
    tokenService = module.get(TokenService);
  });

  it('should return an AuthResult with a fresh token pair on success', async () => {
    tokenService.verifyAndDecodeRefreshToken.mockReturnValue({
      sub: USER_ID,
      type: 'refresh',
    });
    userTypeOrmRepository.findOne.mockResolvedValue(buildOrmUser());
    tokenService.verifyRefreshToken.mockReturnValue(true);
    userTypeOrmRepository.update.mockResolvedValue({
      affected: 1,
      raw: [],
      generatedMaps: [],
    });

    const result = await authRepository.refresh(VALID_PARAMS);

    expect(result).toBeInstanceOf(AuthResult);
    expect(result.tokens).toBe(NEW_TOKENS);
  });

  it('should look up the user by the sub claim among active users', async () => {
    tokenService.verifyAndDecodeRefreshToken.mockReturnValue({
      sub: USER_ID,
      type: 'refresh',
    });
    userTypeOrmRepository.findOne.mockResolvedValue(buildOrmUser());
    tokenService.verifyRefreshToken.mockReturnValue(true);
    userTypeOrmRepository.update.mockResolvedValue({
      affected: 1,
      raw: [],
      generatedMaps: [],
    });

    const findOneSpy = jest.spyOn(userTypeOrmRepository, 'findOne');

    await authRepository.refresh(VALID_PARAMS);

    expect(findOneSpy).toHaveBeenCalledWith({
      where: { id: USER_ID, deletedAt: IsNull() },
    });
  });

  it('should throw InvalidRefreshTokenFailure when the token signature/expiration is invalid', async () => {
    tokenService.verifyAndDecodeRefreshToken.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    const findOneSpy = jest.spyOn(userTypeOrmRepository, 'findOne');

    await expect(authRepository.refresh(VALID_PARAMS)).rejects.toThrow(
      InvalidRefreshTokenFailure,
    );
    expect(findOneSpy).not.toHaveBeenCalled();
  });

  it('should throw InvalidRefreshTokenFailure when the user is not found (deleted or unknown)', async () => {
    tokenService.verifyAndDecodeRefreshToken.mockReturnValue({
      sub: USER_ID,
      type: 'refresh',
    });
    userTypeOrmRepository.findOne.mockResolvedValue(null);

    await expect(authRepository.refresh(VALID_PARAMS)).rejects.toThrow(
      InvalidRefreshTokenFailure,
    );
  });

  it('should throw InvalidRefreshTokenFailure when the user has no active refresh session', async () => {
    tokenService.verifyAndDecodeRefreshToken.mockReturnValue({
      sub: USER_ID,
      type: 'refresh',
    });
    userTypeOrmRepository.findOne.mockResolvedValue(
      buildOrmUser({ refreshTokenHash: null }),
    );

    await expect(authRepository.refresh(VALID_PARAMS)).rejects.toThrow(
      InvalidRefreshTokenFailure,
    );
  });

  describe('replay detection (hash mismatch)', () => {
    it('should throw InvalidRefreshTokenFailure when the hash does not match', async () => {
      tokenService.verifyAndDecodeRefreshToken.mockReturnValue({
        sub: USER_ID,
        type: 'refresh',
      });
      userTypeOrmRepository.findOne.mockResolvedValue(buildOrmUser());
      tokenService.verifyRefreshToken.mockReturnValue(false);
      userTypeOrmRepository.update.mockResolvedValue({
        affected: 1,
        raw: [],
        generatedMaps: [],
      });

      await expect(authRepository.refresh(VALID_PARAMS)).rejects.toThrow(
        InvalidRefreshTokenFailure,
      );
    });

    it('should clear the stored refresh token hash on mismatch', async () => {
      tokenService.verifyAndDecodeRefreshToken.mockReturnValue({
        sub: USER_ID,
        type: 'refresh',
      });
      const ormUser = buildOrmUser();
      userTypeOrmRepository.findOne.mockResolvedValue(ormUser);
      tokenService.verifyRefreshToken.mockReturnValue(false);
      userTypeOrmRepository.update.mockResolvedValue({
        affected: 1,
        raw: [],
        generatedMaps: [],
      });

      const updateSpy = jest.spyOn(userTypeOrmRepository, 'update');

      await authRepository.refresh(VALID_PARAMS).catch(() => undefined);

      expect(updateSpy).toHaveBeenCalledWith(ormUser.id, {
        refreshTokenHash: null,
      });
    });

    it('should not call generateTokenPair when a replay is detected', async () => {
      tokenService.verifyAndDecodeRefreshToken.mockReturnValue({
        sub: USER_ID,
        type: 'refresh',
      });
      userTypeOrmRepository.findOne.mockResolvedValue(buildOrmUser());
      tokenService.verifyRefreshToken.mockReturnValue(false);
      userTypeOrmRepository.update.mockResolvedValue({
        affected: 1,
        raw: [],
        generatedMaps: [],
      });

      const generateTokenPairSpy = jest.spyOn(
        tokenService,
        'generateTokenPair',
      );

      await authRepository.refresh(VALID_PARAMS).catch(() => undefined);

      expect(generateTokenPairSpy).not.toHaveBeenCalled();
    });
  });

  it('should store the new refresh token hash after a successful rotation', async () => {
    tokenService.verifyAndDecodeRefreshToken.mockReturnValue({
      sub: USER_ID,
      type: 'refresh',
    });
    const ormUser = buildOrmUser();
    userTypeOrmRepository.findOne.mockResolvedValue(ormUser);
    tokenService.verifyRefreshToken.mockReturnValue(true);
    const updateSpy = jest
      .spyOn(userTypeOrmRepository, 'update')
      .mockResolvedValue({
        affected: 1,
        raw: [],
        generatedMaps: [],
      });
    const hashRefreshTokenSpy = jest.spyOn(tokenService, 'hashRefreshToken');

    await authRepository.refresh(VALID_PARAMS);

    expect(hashRefreshTokenSpy).toHaveBeenCalledWith(NEW_TOKENS.refreshToken);
    expect(updateSpy).toHaveBeenCalledWith(ormUser.id, {
      refreshTokenHash: 'new-stored-hash',
    });
  });
});
