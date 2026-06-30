import { IAuthRepository } from '../../../../src/auth/domain/repositories/auth-repository.interface';
import { LogoutParams } from '../../../../src/auth/domain/usecases/logout.params';
import { LogoutUseCase } from '../../../../src/auth/domain/usecases/logout.usecase';

/**
 * Unit tests for LogoutUseCase.
 *
 * @competency Unit test harness, TDD cycle.
 * @competency Scenarios: success delegation, error propagation.
 */
describe('LogoutUseCase', () => {
  let logoutUseCase: LogoutUseCase;
  let authRepository: jest.Mocked<IAuthRepository>;

  const VALID_PARAMS = new LogoutParams({
    userId: '550e8400-e29b-41d4-a716-446655440000',
  });

  beforeEach(() => {
    authRepository = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
    } as jest.Mocked<IAuthRepository>;

    logoutUseCase = new LogoutUseCase(authRepository);
  });

  describe('execute', () => {
    it('should delegate to IAuthRepository.logout with the provided params', async () => {
      const logoutSpy = jest
        .spyOn(authRepository, 'logout')
        .mockResolvedValue(undefined);

      await logoutUseCase.execute(VALID_PARAMS);

      expect(logoutSpy).toHaveBeenCalledWith(VALID_PARAMS);
      expect(logoutSpy).toHaveBeenCalledTimes(1);
    });

    it('should resolve with no value on success', async () => {
      authRepository.logout.mockResolvedValue(undefined);

      await expect(
        logoutUseCase.execute(VALID_PARAMS),
      ).resolves.toBeUndefined();
    });

    it('should propagate unexpected errors from the repository', async () => {
      authRepository.logout.mockRejectedValue(
        new Error('Database unavailable'),
      );

      await expect(logoutUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        'Database unavailable',
      );
    });
  });
});

describe('LogoutParams', () => {
  it('should store userId as a readonly field', () => {
    const params = new LogoutParams({ userId: 'user-id-value' });

    expect(params.userId).toBe('user-id-value');
  });
});
