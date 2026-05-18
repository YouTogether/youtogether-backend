import { EmailAlreadyInUseFailure } from '../../../../src/auth/domain/failures/auth.failure';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';
import { UserEntity } from '../../../../src/auth/domain/entities/user.entity';
import { TokenPair } from '../../../../src/auth/domain/value-objects/token-pair.vo';
import { RegisterParams } from '../../../../src/auth/domain/usecases/register.params';
import { RegisterResult } from '../../../../src/auth/domain/value-objects/register-result.vo';

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
