import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { IsNull, Repository } from 'typeorm';

import { AuthRepositoryImpl } from '../../../../src/auth/data/repositories/auth-repository.impl';
import { UserOrmEntity } from '../../../../src/auth/data/entities/user.orm-entity';
import { TokenService } from '../../../../src/auth/data/services/token.service';
import { UserNotFoundFailure } from '../../../../src/auth/domain/failures/auth.failure';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';
import { UserEntity } from '../../../../src/auth/domain/entities/user.entity';
import { GetCurrentUserParams } from '../../../../src/auth/domain/usecases/get-current-user.params';

/**
 * Unit tests for AuthRepositoryImpl.getCurrentUser().
 *
 * @competency Unit test harness, TDD.
 * @competency Scenarios: active user found, unknown id, soft-deleted user.
 */
describe('AuthRepositoryImpl — getCurrentUser()', () => {
  let authRepository: AuthRepositoryImpl;
  let userTypeOrmRepository: jest.Mocked<Repository<UserOrmEntity>>;

  const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const VALID_PARAMS = new GetCurrentUserParams({ userId: USER_ID });

  const buildOrmUser = (
    overrides: Partial<UserOrmEntity> = {},
  ): UserOrmEntity => {
    const orm = new UserOrmEntity();
    orm.id = USER_ID;
    orm.email = 'existing@example.com';
    orm.passwordHash = '$2b$12$validhashedpassword.stored.in.db.xxxx';
    orm.username = 'existinguser';
    orm.role = UserRole.REGISTERED;
    orm.refreshTokenHash = 'some-hash';
    orm.createdAt = new Date('2025-01-01T00:00:00Z');
    orm.updatedAt = new Date('2025-01-01T00:00:00Z');
    orm.deletedAt = null;
    return Object.assign(orm, overrides);
  };

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
            generateTokenPair: jest.fn(),
            hashRefreshToken: jest.fn(),
          },
        },
      ],
    }).compile();

    authRepository = module.get<AuthRepositoryImpl>(AuthRepositoryImpl);
    userTypeOrmRepository = module.get(getRepositoryToken(UserOrmEntity));
  });

  it('should return a UserEntity for an active user', async () => {
    userTypeOrmRepository.findOne.mockResolvedValue(buildOrmUser());

    const result = await authRepository.getCurrentUser(VALID_PARAMS);

    expect(result).toBeInstanceOf(UserEntity);
    expect(result.id).toBe(USER_ID);
    expect(result.email).toBe('existing@example.com');
    expect(result.username).toBe('existinguser');
    expect(result.role).toBe(UserRole.REGISTERED);
  });

  it('should query for an active user by id (deletedAt IS NULL)', async () => {
    const findOneSpy = jest
      .spyOn(userTypeOrmRepository, 'findOne')
      .mockResolvedValue(buildOrmUser());

    await authRepository.getCurrentUser(VALID_PARAMS);

    expect(findOneSpy).toHaveBeenCalledWith({
      where: { id: USER_ID, deletedAt: IsNull() },
    });
  });

  it('should not expose passwordHash or refreshTokenHash in the returned entity', async () => {
    userTypeOrmRepository.findOne.mockResolvedValue(buildOrmUser());

    const result = await authRepository.getCurrentUser(VALID_PARAMS);
    const record = result as unknown as Record<string, unknown>;

    expect(record.passwordHash).toBeUndefined();
    expect(record.refreshTokenHash).toBeUndefined();
  });

  it('should throw UserNotFoundFailure when no user matches the id', async () => {
    userTypeOrmRepository.findOne.mockResolvedValue(null);

    await expect(authRepository.getCurrentUser(VALID_PARAMS)).rejects.toThrow(
      UserNotFoundFailure,
    );
  });

  it('should throw UserNotFoundFailure for a soft-deleted user (excluded by the query)', async () => {
    // TypeORM's `where: { deletedAt: IsNull() }` excludes soft-deleted rows
    // at the query level, so a deleted user simply yields null here.
    userTypeOrmRepository.findOne.mockResolvedValue(null);

    await expect(authRepository.getCurrentUser(VALID_PARAMS)).rejects.toThrow(
      UserNotFoundFailure,
    );
  });
});
