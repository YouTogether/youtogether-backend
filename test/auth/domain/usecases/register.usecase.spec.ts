import { EmailAlreadyInUseFailure } from '../../../../src/auth/domain/failures/auth.failure';
import { IAuthRepository } from '../../../../src/auth/domain/repositories/auth-repository.interface';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';
import { UserEntity } from '../../../../src/auth/domain/entities/user.entity';
import { TokenPair } from '../../../../src/auth/domain/value-objects/token-pair.vo';
import { RegisterParams } from '../../../../src/auth/domain/usecases/register.params';
import { AuthResult } from '../../../../src/auth/domain/value-objects/auth-result.vo';
import { RegisterUseCase } from '../../../../src/auth/domain/usecases/register.usecase';

/**
 * Unit tests for RegisterUseCase.
 *
 * The use case is a thin orchestrator; these tests verify delegation
 * and exception propagation, not business logic (which lives in the repository).
 *
 * @competency Unit test harness, TDD cycle.
 * @competency Test scenarios: success and failure paths.
 */
describe('RegisterUseCase', () => {
  let registerUseCase: RegisterUseCase;
  const registerMock = jest.fn<Promise<AuthResult>, [RegisterParams]>();
  const loginMock = jest.fn();
  const refreshMock = jest.fn();

  const VALID_PARAMS = new RegisterParams({
    email: 'test@example.com',
    password: 'securepassword',
    username: 'testuser',
  });

  const MOCK_USER = new UserEntity({
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    username: 'testuser',
    role: UserRole.REGISTERED,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  });

  const MOCK_TOKENS = new TokenPair({
    accessToken: 'mock.access.token',
    refreshToken: 'a'.repeat(64),
  });

  const MOCK_RESULT = new AuthResult({
    user: MOCK_USER,
    tokens: MOCK_TOKENS,
  });

  beforeEach(() => {
    registerMock.mockReset();
    loginMock.mockReset();
    refreshMock.mockReset();
    const authRepository: IAuthRepository = {
      register: registerMock,
      login: loginMock,
      refresh: refreshMock,
    };
    registerUseCase = new RegisterUseCase(authRepository);
  });

  describe('execute', () => {
    it('should delegate to IAuthRepository.register with the provided params', async () => {
      registerMock.mockResolvedValue(MOCK_RESULT);

      await registerUseCase.execute(VALID_PARAMS);

      expect(registerMock).toHaveBeenCalledWith(VALID_PARAMS);
      expect(registerMock).toHaveBeenCalledTimes(1);
    });

    it('should return the AuthResult provided by the repository', async () => {
      registerMock.mockResolvedValue(MOCK_RESULT);

      const result = await registerUseCase.execute(VALID_PARAMS);

      expect(result).toBe(MOCK_RESULT);
      expect(result.user).toBe(MOCK_USER);
      expect(result.tokens).toBe(MOCK_TOKENS);
    });

    it('should propagate EmailAlreadyInUseFailure from the repository', async () => {
      registerMock.mockRejectedValue(
        new EmailAlreadyInUseFailure(VALID_PARAMS.email),
      );

      await expect(registerUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        EmailAlreadyInUseFailure,
      );
    });

    it('should not catch or transform unexpected errors', async () => {
      registerMock.mockRejectedValue(new Error('Database connection lost'));

      await expect(registerUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        'Database connection lost',
      );
    });
  });
});

describe('RegisterParams', () => {
  it('should store email, password, and username as readonly fields', () => {
    const params = new RegisterParams({
      email: 'user@example.com',
      password: 'p4ssw0rd!',
      username: 'myuser',
    });

    expect(params.email).toBe('user@example.com');
    expect(params.password).toBe('p4ssw0rd!');
    expect(params.username).toBe('myuser');
  });
});

describe('AuthResult', () => {
  it('should store user and tokens as readonly fields', () => {
    const user = new UserEntity({
      id: 'uuid',
      email: 'a@b.com',
      username: 'u',
      role: UserRole.REGISTERED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const tokens = new TokenPair({ accessToken: 'at', refreshToken: 'rt' });
    const result = new AuthResult({ user, tokens });

    expect(result.user).toBe(user);
    expect(result.tokens).toBe(tokens);
  });
});

describe('EmailAlreadyInUseFailure', () => {
  it('should extend Error and carry the email address', () => {
    const failure = new EmailAlreadyInUseFailure('dup@example.com');

    expect(failure).toBeInstanceOf(Error);
    expect(failure).toBeInstanceOf(EmailAlreadyInUseFailure);
    expect(failure.email).toBe('dup@example.com');
    expect(failure.name).toBe('EmailAlreadyInUseFailure');
  });

  it('should include the email in the error message', () => {
    const failure = new EmailAlreadyInUseFailure('dup@example.com');

    expect(failure.message).toContain('dup@example.com');
  });
});
