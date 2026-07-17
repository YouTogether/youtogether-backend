import { IAuthRepository } from '../../../../src/auth/domain/repositories/auth-repository.interface';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';
import { UserEntity } from '../../../../src/auth/domain/entities/user.entity';
import { UserNotFoundFailure } from '../../../../src/auth/domain/failures/auth.failure';
import { GetCurrentUserParams } from '../../../../src/auth/domain/usecases/get-current-user.params';
import { GetCurrentUserUseCase } from '../../../../src/auth/domain/usecases/get-current-user.usecase';

/**
 * Unit tests for GetCurrentUserUseCase.
 *
 * @competency Unit test harness, TDD cycle.
 * @competency Scenarios: success delegation, error propagation.
 */
describe('GetCurrentUserUseCase', () => {
  let getCurrentUserUseCase: GetCurrentUserUseCase;
  let authRepository: jest.Mocked<IAuthRepository>;

  const VALID_PARAMS = new GetCurrentUserParams({
    userId: '550e8400-e29b-41d4-a716-446655440000',
  });

  const MOCK_USER = new UserEntity({
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    username: 'testuser',
    role: UserRole.REGISTERED,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  });

  beforeEach(() => {
    authRepository = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      getCurrentUser: jest.fn(),
    } as jest.Mocked<IAuthRepository>;

    getCurrentUserUseCase = new GetCurrentUserUseCase(authRepository);
  });

  describe('execute', () => {
    it('should delegate to IAuthRepository.getCurrentUser with the provided params', async () => {
      const getCurrentUserSpy = jest
        .spyOn(authRepository, 'getCurrentUser')
        .mockResolvedValue(MOCK_USER);

      await getCurrentUserUseCase.execute(VALID_PARAMS);

      expect(getCurrentUserSpy).toHaveBeenCalledWith(VALID_PARAMS);
      expect(getCurrentUserSpy).toHaveBeenCalledTimes(1);
    });

    it('should return the UserEntity provided by the repository', async () => {
      authRepository.getCurrentUser.mockResolvedValue(MOCK_USER);

      const result = await getCurrentUserUseCase.execute(VALID_PARAMS);

      expect(result).toBe(MOCK_USER);
      expect(result.email).toBe('test@example.com');
    });

    it('should propagate UserNotFoundFailure from the repository', async () => {
      authRepository.getCurrentUser.mockRejectedValue(
        new UserNotFoundFailure(),
      );

      await expect(getCurrentUserUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        UserNotFoundFailure,
      );
    });

    it('should not catch or transform unexpected errors', async () => {
      authRepository.getCurrentUser.mockRejectedValue(
        new Error('Database connection lost'),
      );

      await expect(getCurrentUserUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        'Database connection lost',
      );
    });
  });
});

describe('GetCurrentUserParams', () => {
  it('should store userId as a readonly field', () => {
    const params = new GetCurrentUserParams({ userId: 'user-id-value' });

    expect(params.userId).toBe('user-id-value');
  });
});

describe('UserNotFoundFailure', () => {
  it('should extend Error with the correct name and generic message', () => {
    const failure = new UserNotFoundFailure();

    expect(failure).toBeInstanceOf(Error);
    expect(failure).toBeInstanceOf(UserNotFoundFailure);
    expect(failure.name).toBe('UserNotFoundFailure');
    expect(failure.message).toBe('User not found or no longer active.');
  });
});
