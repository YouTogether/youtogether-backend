import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthRepositoryImpl } from '../../../../src/auth/data/repositories/auth-repository.impl';
import { UserOrmEntity } from '../../../../src/auth/data/entities/user.orm-entity';
import { TokenService } from '../../../../src/auth/data/services/token.service';
import { EmailAlreadyInUseFailure } from '../../../../src/auth/domain/failures/auth.failure';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';
import { TokenPair } from '../../../../src/auth/domain/value-objects/token-pair.vo';
import { RegisterParams } from '../../../../src/auth/domain/usecases/register.params';
import { RegisterResult } from '../../../../src/auth/domain/value-objects/register-result.vo';

jest.mock('bcrypt');

/**
 * Unit tests for AuthRepositoryImpl.
 *
 * All infrastructure dependencies (TypeORM Repository, TokenService) are mocked.
 * Tests verify the registration flow: uniqueness check, bcrypt hashing,
 * persistence, token generation, hash storage.
 *
 * @competency Unit test harness, TDD.
 * @competency Test scenarios: success, duplicate email, persistence flow.
 */
describe('AuthRepositoryImpl', () => {
  let authRepository: AuthRepositoryImpl;
  let userTypeOrmRepository: jest.Mocked<Repository<UserOrmEntity>>;
  let tokenService: jest.Mocked<TokenService>;

  const VALID_PARAMS = new RegisterParams({
    email: 'new@example.com',
    password: 'securepassword',
    username: 'newuser',
  });

  const MOCK_SAVED_ORM = (() => {
    const orm = new UserOrmEntity();
    orm.id = '550e8400-e29b-41d4-a716-446655440000';
    orm.email = 'new@example.com';
    orm.passwordHash = '$2b$12$hashedvalue';
    orm.username = 'newuser';
    orm.role = UserRole.REGISTERED;
    orm.refreshTokenHash = null;
    orm.createdAt = new Date('2025-01-01T00:00:00Z');
    orm.updatedAt = new Date('2025-01-01T00:00:00Z');
    orm.deletedAt = null;
    return orm;
  })();

  const MOCK_TOKENS = new TokenPair({
    accessToken: 'mock.access.token',
    refreshToken: 'a'.repeat(64),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

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
            generateTokenPair: jest.fn(),
            hashRefreshToken: jest.fn(),
          },
        },
      ],
    }).compile();

    authRepository = module.get<AuthRepositoryImpl>(AuthRepositoryImpl);
    userTypeOrmRepository = module.get(getRepositoryToken(UserOrmEntity));
    tokenService = module.get(TokenService);
  });

  describe('register', () => {
    beforeEach(() => {
      userTypeOrmRepository.findOne.mockResolvedValue(null);
      userTypeOrmRepository.create.mockReturnValue(MOCK_SAVED_ORM);
      userTypeOrmRepository.save.mockResolvedValue(MOCK_SAVED_ORM);
      userTypeOrmRepository.update.mockResolvedValue({
        affected: 1,
        raw: [],
        generatedMaps: [],
      });
      tokenService.generateTokenPair.mockResolvedValue(MOCK_TOKENS);
      tokenService.hashRefreshToken.mockReturnValue('hashed_refresh_token');

      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$hashedvalue');
    });

    it('should return a RegisterResult with user and tokens on success', async () => {
      const result = await authRepository.register(VALID_PARAMS);

      expect(result).toBeInstanceOf(RegisterResult);
      expect(result.user.email).toBe('new@example.com');
      expect(result.user.username).toBe('newuser');
      expect(result.tokens).toBe(MOCK_TOKENS);
    });

    it('should query for existing active users by email', async () => {
      const findOneSpy = jest.spyOn(userTypeOrmRepository, 'findOne');

      await authRepository.register(VALID_PARAMS);

      expect(findOneSpy).toHaveBeenCalledWith({
        where: { email: VALID_PARAMS.email, deletedAt: IsNull() },
      });
    });

    it('should throw EmailAlreadyInUseFailure when email is already registered', async () => {
      userTypeOrmRepository.findOne.mockResolvedValue(MOCK_SAVED_ORM);

      await expect(authRepository.register(VALID_PARAMS)).rejects.toThrow(
        EmailAlreadyInUseFailure,
      );
    });

    it('should throw EmailAlreadyInUseFailure with the correct email', async () => {
      userTypeOrmRepository.findOne.mockResolvedValue(MOCK_SAVED_ORM);

      const error = await authRepository
        .register(VALID_PARAMS)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(EmailAlreadyInUseFailure);
      expect((error as EmailAlreadyInUseFailure).email).toBe(
        VALID_PARAMS.email,
      );
    });

    it('should not reach save() when email collision is detected', async () => {
      userTypeOrmRepository.findOne.mockResolvedValue(MOCK_SAVED_ORM);
      const saveSpy = jest.spyOn(userTypeOrmRepository, 'save');

      await authRepository.register(VALID_PARAMS).catch(() => undefined);

      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('should hash the password with bcrypt before saving', async () => {
      await authRepository.register(VALID_PARAMS);

      expect(bcrypt.hash).toHaveBeenCalledWith(VALID_PARAMS.password, 12);
    });

    it('should generate a token pair using the saved user id and role', async () => {
      const generateTokenPairSpy = jest.spyOn(
        tokenService,
        'generateTokenPair',
      );

      await authRepository.register(VALID_PARAMS);

      expect(generateTokenPairSpy).toHaveBeenCalledWith(
        MOCK_SAVED_ORM.id,
        MOCK_SAVED_ORM.role,
      );
    });

    it('should hash the refresh token and store it in the database', async () => {
      const hashRefreshTokenSpy = jest.spyOn(tokenService, 'hashRefreshToken');
      const updateSpy = jest.spyOn(userTypeOrmRepository, 'update');

      await authRepository.register(VALID_PARAMS);
      expect(hashRefreshTokenSpy).toHaveBeenCalledWith(
        MOCK_TOKENS.refreshToken,
      );
      expect(updateSpy).toHaveBeenCalledWith(MOCK_SAVED_ORM.id, {
        refreshTokenHash: 'hashed_refresh_token',
      });
    });

    it('should not expose passwordHash in the returned UserEntity', async () => {
      const result = await authRepository.register(VALID_PARAMS);

      expect(
        (result.user as unknown as Record<string, unknown>).passwordHash,
      ).toBeUndefined();
    });
  });
});
