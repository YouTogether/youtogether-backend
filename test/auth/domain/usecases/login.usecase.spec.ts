import { IAuthRepository } from '../../../../src/auth/domain/repositories/auth-repository.interface';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';
import { UserEntity } from '../../../../src/auth/domain/entities/user.entity';
import { TokenPair } from '../../../../src/auth/domain/value-objects/token-pair.vo';
import { AuthResult } from '../../../../src/auth/domain/value-objects/auth-result.vo';
import { InvalidCredentialsFailure } from '../../../../src/auth/domain/failures/auth.failure';
import { LoginParams } from '../../../../src/auth/domain/usecases/login.params';
import { LoginUseCase } from '../../../../src/auth/domain/usecases/login.usecase';

/**
 * Unit tests for LoginUseCase (B-A02-T1 — domain layer).
 *
 * Mock repository methods are captured as standalone consts to avoid the
 * @typescript-eslint/unbound-method false positive on method references.
 *
 * @competency Unit test harness, TDD cycle.
 * @competency Scenarios: success, invalid credentials.
 */
describe('LoginUseCase', () => {
  let loginUseCase: LoginUseCase;
  const loginMock = jest.fn<Promise<AuthResult>, [LoginParams]>();
  const registerMock = jest.fn();
  const refreshMock = jest.fn();

  const VALID_PARAMS = new LoginParams({
    email: 'test@example.com',
    password: 'securepassword',
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
      accessToken: 'mock.access.token',
      refreshToken: 'a'.repeat(64),
    }),
  });

  beforeEach(() => {
    loginMock.mockReset();
    registerMock.mockReset();
    refreshMock.mockReset();
    const authRepository: IAuthRepository = {
      register: registerMock,
      login: loginMock,
      refresh: refreshMock,
    };
    loginUseCase = new LoginUseCase(authRepository);
  });

  describe('execute', () => {
    it('should delegate to IAuthRepository.login with the provided params', async () => {
      loginMock.mockResolvedValue(MOCK_RESULT);

      await loginUseCase.execute(VALID_PARAMS);

      expect(loginMock).toHaveBeenCalledWith(VALID_PARAMS);
      expect(loginMock).toHaveBeenCalledTimes(1);
    });

    it('should return the AuthResult provided by the repository', async () => {
      loginMock.mockResolvedValue(MOCK_RESULT);

      const result = await loginUseCase.execute(VALID_PARAMS);

      expect(result).toBe(MOCK_RESULT);
      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens.accessToken).toBe('mock.access.token');
    });

    it('should propagate InvalidCredentialsFailure from the repository', async () => {
      loginMock.mockRejectedValue(new InvalidCredentialsFailure());

      await expect(loginUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        InvalidCredentialsFailure,
      );
    });

    it('should not catch or transform unexpected errors', async () => {
      loginMock.mockRejectedValue(new Error('Database connection lost'));

      await expect(loginUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        'Database connection lost',
      );
    });
  });
});

describe('LoginParams', () => {
  it('should store email and password as readonly fields', () => {
    const params = new LoginParams({
      email: 'user@example.com',
      password: 'pass',
    });

    expect(params.email).toBe('user@example.com');
    expect(params.password).toBe('pass');
  });
});

describe('InvalidCredentialsFailure', () => {
  it('should extend Error with the correct name', () => {
    const failure = new InvalidCredentialsFailure();

    expect(failure).toBeInstanceOf(Error);
    expect(failure).toBeInstanceOf(InvalidCredentialsFailure);
    expect(failure.name).toBe('InvalidCredentialsFailure');
  });

  it('should use a generic message that does not mention email or password separately', () => {
    const failure = new InvalidCredentialsFailure();

    expect(failure.message).toBe('Invalid email or password.');
  });
});
