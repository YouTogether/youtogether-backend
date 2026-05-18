import { EmailAlreadyInUseFailure } from '../../../../src/auth/domain/failures/auth.failure';
import { IAuthRepository } from '../../../../src/auth/domain/repositories/auth-repository.interface';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';
import { UserEntity } from '../../../../src/auth/domain/entities/user.entity';
import { TokenPair } from '../../../../src/auth/domain/value-objects/token-pair.vo';
import { RegisterParams } from '../../../../src/auth/domain/usecases/register.params';
import { RegisterResult } from '../../../../src/auth/domain/value-objects/register-result.vo';
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
  let authRepository: jest.Mocked<IAuthRepository>;

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

  const MOCK_RESULT = new RegisterResult({
    user: MOCK_USER,
    tokens: MOCK_TOKENS,
  });

  beforeEach(() => {
    authRepository = {
      register: jest.fn(),
    } as jest.Mocked<IAuthRepository>;

    registerUseCase = new RegisterUseCase(authRepository);
  });

  describe('execute', () => {
    it('should delegate to IAuthRepository.register with the provided params', async () => {
      const registerSpy = jest
        .spyOn(authRepository, 'register')
        .mockResolvedValue(MOCK_RESULT);

      await registerUseCase.execute(VALID_PARAMS);

      expect(registerSpy).toHaveBeenCalledWith(VALID_PARAMS);
      expect(registerSpy).toHaveBeenCalledTimes(1);
    });

    it('should return the RegisterResult provided by the repository', async () => {
      authRepository.register.mockResolvedValue(MOCK_RESULT);

      await expect(registerUseCase.execute(VALID_PARAMS)).resolves.toBe(
        MOCK_RESULT,
      );
    });

    it('should propagate EmailAlreadyInUseFailure from the repository', async () => {
      const failure = new EmailAlreadyInUseFailure(VALID_PARAMS.email);
      authRepository.register.mockRejectedValue(failure);

      await expect(registerUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        EmailAlreadyInUseFailure,
      );
    });

    it('should propagate the exact failure instance thrown by the repository', async () => {
      const failure = new EmailAlreadyInUseFailure('test@example.com');
      authRepository.register.mockRejectedValue(failure);

      await expect(registerUseCase.execute(VALID_PARAMS)).rejects.toBe(failure);
    });

    it('should not catch or transform unexpected errors', async () => {
      const unexpectedError = new Error('Database connection lost');
      authRepository.register.mockRejectedValue(unexpectedError);

      await expect(registerUseCase.execute(VALID_PARAMS)).rejects.toThrow(
        'Database connection lost',
      );
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

  describe('RegisterResult', () => {
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
      const result = new RegisterResult({ user, tokens });

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
});
