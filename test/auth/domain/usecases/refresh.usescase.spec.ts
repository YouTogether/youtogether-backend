import { IAuthRepository } from '../../../../src/auth/domain/repositories/auth-repository.interface';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';
import { UserEntity } from '../../../../src/auth/domain/entities/user.entity';
import { TokenPair } from '../../../../src/auth/domain/value-objects/token-pair.vo';
import { AuthResult } from '../../../../src/auth/domain/value-objects/auth-result.vo';
import { InvalidRefreshTokenFailure } from '../../../../src/auth/domain/failures/auth.failure';
import { RefreshParams } from '../../../../src/auth/domain/usecases/refresh.params';
import { RefreshUseCase } from '../../../../src/auth/domain/usecases/refresh.usecase';

/**
 * Unit tests for RefreshUseCase.
 *
 * @competency Unit test harness, TDD cycle.
 * @competency Scenarios: success, invalid/expired/replayed token.
 */
describe('RefreshUseCase', () => {
  let refreshUseCase: RefreshUseCase;
  let authRepository: jest.Mocked<IAuthRepository>;

  const VALID_PARAMS = new RefreshParams({
    refreshToken: 'a-valid-refresh-jwt',
  });

  const MOCK_RESULT = new AuthResult({
    user: new UserEntity({
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      username: 'testuser',
      role: UserRole.REGISTERED,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T00:00:00Z'),
    }),
    tokens: new TokenPair({
      accessToken: 'new.access.token',
      refreshToken: 'new-refresh-jwt',
    }),
  });

  beforeEach(() => {
    authRepository = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      getCurrentUser: jest.fn(),
    } as jest.Mocked<IAuthRepository>;

    refreshUseCase = new RefreshUseCase(authRepository);
  });

  describe('execute', () => {
    it('should delegate to IAuthRepository.refresh with the provided params', async () => {
      const refreshSpy = jest
        .spyOn(authRepository, 'refresh')
        .mockResolvedValue(MOCK_RESULT);

      await refreshUseCase.execute(VALID_PARAMS);

      expect(refreshSpy).toHaveBeenCalledWith(VALID_PARAMS);
      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });

    it('should return the AuthResult provided by the repository', async () => {
      authRepository.refresh.mockResolvedValue(MOCK_RESULT);

      const result = await refreshUseCase.execute(VALID_PARAMS);

      expect(result).toBe(MOCK_RESULT);
      expect(result.tokens.accessToken).toBe('new.access.token');
      expect(result.tokens.refreshToken).toBe('new-refresh-jwt');
    });

    it('should propagate InvalidRefreshTokenFailure from the repository', async () => {
      authRepository.refresh.mockRejectedValue(
        new InvalidRefreshTokenFailure(),
      );

      await expect(refreshUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        InvalidRefreshTokenFailure,
      );
    });

    it('should not catch or transform unexpected errors', async () => {
      authRepository.refresh.mockRejectedValue(
        new Error('Database connection lost'),
      );

      await expect(refreshUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        'Database connection lost',
      );
    });
  });
});

describe('RefreshParams', () => {
  it('should store refreshToken as a readonly field', () => {
    const params = new RefreshParams({ refreshToken: 'token-value' });
    expect(params.refreshToken).toBe('token-value');
  });
});

describe('InvalidRefreshTokenFailure', () => {
  it('should extend Error with the correct name and generic message', () => {
    const failure = new InvalidRefreshTokenFailure();

    expect(failure).toBeInstanceOf(Error);
    expect(failure).toBeInstanceOf(InvalidRefreshTokenFailure);
    expect(failure.name).toBe('InvalidRefreshTokenFailure');
    expect(failure.message).toBe('Invalid or expired refresh token.');
  });
});
