import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';

import { AuthRepositoryImpl } from '../../../../src/auth/data/repositories/auth-repository.impl';
import { UserOrmEntity } from '../../../../src/auth/data/entities/user.orm-entity';
import { TokenService } from '../../../../src/auth/data/services/token.service';
import { LogoutParams } from '../../../../src/auth/domain/usecases/logout.params';

/**
 * Unit tests for AuthRepositoryImpl.logout().
 *
 * @competency Unit test harness, TDD.
 * @competency Scenarios: clears the stored hash, idempotent on repeated calls.
 */
describe('AuthRepositoryImpl — logout()', () => {
  let authRepository: AuthRepositoryImpl;
  let userTypeOrmRepository: jest.Mocked<Repository<UserOrmEntity>>;

  const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const VALID_PARAMS = new LogoutParams({ userId: USER_ID });

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

  it('should clear refreshTokenHash for the given user', async () => {
    const updateSpy = jest
      .spyOn(userTypeOrmRepository, 'update')
      .mockResolvedValue({
        affected: 1,
        raw: [],
        generatedMaps: [],
      });

    await authRepository.logout(VALID_PARAMS);

    expect(updateSpy).toHaveBeenCalledWith(USER_ID, {
      refreshTokenHash: null,
    });
  });

  it('should resolve with no value', async () => {
    userTypeOrmRepository.update.mockResolvedValue({
      affected: 1,
      raw: [],
      generatedMaps: [],
    });

    await expect(authRepository.logout(VALID_PARAMS)).resolves.toBeUndefined();
  });

  it('should not throw when the user has no active session (affected: 0)', async () => {
    userTypeOrmRepository.update.mockResolvedValue({
      affected: 0,
      raw: [],
      generatedMaps: [],
    });

    await expect(authRepository.logout(VALID_PARAMS)).resolves.toBeUndefined();
  });

  it('should not call findOne (no existence check before update)', async () => {
    userTypeOrmRepository.update.mockResolvedValue({
      affected: 1,
      raw: [],
      generatedMaps: [],
    });

    const findOneSpy = jest.spyOn(userTypeOrmRepository, 'findOne');

    await authRepository.logout(VALID_PARAMS);

    expect(findOneSpy).not.toHaveBeenCalled();
  });
});
