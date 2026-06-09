import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthRepositoryImpl } from '../../../../src/auth/data/repositories/auth-repository.impl';
import { UserOrmEntity } from '../../../../src/auth/data/entities/user.orm-entity';
import { TokenService } from '../../../../src/auth/data/services/token.service';
import { InvalidCredentialsFailure } from '../../../../src/auth/domain/failures/auth.failure';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';
import { TokenPair } from '../../../../src/auth/domain/value-objects/token-pair.vo';
import { AuthResult } from '../../../../src/auth/domain/value-objects/auth-result.vo';
import { LoginParams } from '../../../../src/auth/domain/usecases/login.params';

jest.mock('bcrypt');

/**
 * Unit tests for AuthRepositoryImpl.login().
 *
 * Covers:
 * - Successful login: user found, password matches.
 * - Unknown email: user not found.
 * - Wrong password: user found, password does not match.
 * - Deleted user: excluded from lookup (deletedAt IS NOT NULL).
 * - Timing protection: compare() always called.
 * - Token generation and refresh token hash storage.
 *
 * TokenService mock methods are captured as standalone jest.fn() consts to
 * avoid the @typescript-eslint/unbound-method false positive when asserting
 * on them. The bcrypt module is auto-mocked via jest.mock('bcrypt').
 *
 * @competency Unit test harness, TDD.
 * @competency Scenarios from the acceptance criteria.
 */
describe('AuthRepositoryImpl — login()', () => {
  let authRepository: AuthRepositoryImpl;
  let userTypeOrmRepository: jest.Mocked<Repository<UserOrmEntity>>;

  const generateTokenPairMock = jest.fn<
    Promise<TokenPair>,
    [string, UserRole]
  >();
  const hashRefreshTokenMock = jest.fn<string, [string]>();

  const compareMock = bcrypt.compare as jest.MockedFunction<
    typeof bcrypt.compare
  >;

  const PLAIN_PASSWORD = 'securepassword';
  const VALID_PARAMS = new LoginParams({
    email: 'existing@example.com',
    password: PLAIN_PASSWORD,
  });

  const buildOrmUser = (
    overrides: Partial<UserOrmEntity> = {},
  ): UserOrmEntity => {
    const orm = new UserOrmEntity();
    orm.id = '550e8400-e29b-41d4-a716-446655440000';
    orm.email = 'existing@example.com';
    orm.passwordHash = '$2b$12$validhashedpassword.stored.in.db.xxxx';
    orm.username = 'existinguser';
    orm.role = UserRole.REGISTERED;
    orm.refreshTokenHash = null;
    orm.createdAt = new Date('2025-01-01T00:00:00Z');
    orm.updatedAt = new Date('2025-01-01T00:00:00Z');
    orm.deletedAt = null;
    return Object.assign(orm, overrides);
  };

  const MOCK_TOKENS = new TokenPair({
    accessToken: 'mock.access.token',
    refreshToken: 'b'.repeat(64),
  });

  beforeEach(async () => {
    generateTokenPairMock.mockReset();
    hashRefreshTokenMock.mockReset();
    compareMock.mockReset();

    generateTokenPairMock.mockResolvedValue(MOCK_TOKENS);
    hashRefreshTokenMock.mockReturnValue('hashed_refresh');

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
            generateTokenPair: generateTokenPairMock,
            hashRefreshToken: hashRefreshTokenMock,
          },
        },
      ],
    }).compile();

    authRepository = module.get<AuthRepositoryImpl>(AuthRepositoryImpl);
    userTypeOrmRepository = module.get(getRepositoryToken(UserOrmEntity));
  });

  it('should return an AuthResult on successful login', async () => {
    userTypeOrmRepository.findOne.mockResolvedValue(buildOrmUser());
    compareMock.mockResolvedValue(true as never);
    userTypeOrmRepository.update.mockResolvedValue({
      affected: 1,
      raw: [],
      generatedMaps: [],
    });

    const result = await authRepository.login(VALID_PARAMS);

    expect(result).toBeInstanceOf(AuthResult);
    expect(result.user.email).toBe('existing@example.com');
    expect(result.tokens).toBe(MOCK_TOKENS);
  });

  it('should query for active users by email only', async () => {
    const findOneSpy = jest
      .spyOn(userTypeOrmRepository, 'findOne')
      .mockResolvedValue(buildOrmUser());
    compareMock.mockResolvedValue(true as never);
    userTypeOrmRepository.update.mockResolvedValue({
      affected: 1,
      raw: [],
      generatedMaps: [],
    });

    await authRepository.login(VALID_PARAMS);

    expect(findOneSpy).toHaveBeenCalledWith({
      where: { email: VALID_PARAMS.email, deletedAt: IsNull() },
    });
  });

  it('should throw InvalidCredentialsFailure when email is not found', async () => {
    userTypeOrmRepository.findOne.mockResolvedValue(null);
    compareMock.mockResolvedValue(false as never);

    await expect(authRepository.login(VALID_PARAMS)).rejects.toThrow(
      InvalidCredentialsFailure,
    );
  });

  it('should throw InvalidCredentialsFailure when password does not match', async () => {
    userTypeOrmRepository.findOne.mockResolvedValue(buildOrmUser());
    compareMock.mockResolvedValue(false as never);

    await expect(authRepository.login(VALID_PARAMS)).rejects.toThrow(
      InvalidCredentialsFailure,
    );
  });

  it('should always call compare() even when the user is not found (timing protection)', async () => {
    userTypeOrmRepository.findOne.mockResolvedValue(null);
    compareMock.mockResolvedValue(false as never);

    await authRepository.login(VALID_PARAMS).catch(() => undefined);

    expect(compareMock).toHaveBeenCalledTimes(1);
  });

  it('should use the dummy hash when the user is not found', async () => {
    userTypeOrmRepository.findOne.mockResolvedValue(null);
    compareMock.mockResolvedValue(false as never);

    await authRepository.login(VALID_PARAMS).catch(() => undefined);

    const hashUsed = compareMock.mock.calls[0][1];
    expect(hashUsed).toMatch(/^\$2b\$12\$invalidhash/);
  });

  it('should store the refresh token hash after successful login', async () => {
    userTypeOrmRepository.findOne.mockResolvedValue(buildOrmUser());
    compareMock.mockResolvedValue(true as never);
    const updateSpy = jest
      .spyOn(userTypeOrmRepository, 'update')
      .mockResolvedValue({
        affected: 1,
        raw: [],
        generatedMaps: [],
      });

    await authRepository.login(VALID_PARAMS);

    expect(hashRefreshTokenMock).toHaveBeenCalledWith(MOCK_TOKENS.refreshToken);
    expect(updateSpy).toHaveBeenCalledWith(buildOrmUser().id, {
      refreshTokenHash: 'hashed_refresh',
    });
  });

  it('should not expose passwordHash in the returned UserEntity', async () => {
    userTypeOrmRepository.findOne.mockResolvedValue(buildOrmUser());
    compareMock.mockResolvedValue(true as never);
    userTypeOrmRepository.update.mockResolvedValue({
      affected: 1,
      raw: [],
      generatedMaps: [],
    });

    const result = await authRepository.login(VALID_PARAMS);

    expect(
      (result.user as unknown as Record<string, unknown>).passwordHash,
    ).toBeUndefined();
  });
});
