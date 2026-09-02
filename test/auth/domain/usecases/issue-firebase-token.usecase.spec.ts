import { IAuthRepository } from '../../../../src/auth/domain/repositories/auth-repository.interface';
import { IFirebaseAuthProvider } from '../../../../src/auth/domain/repositories/firebase-auth-provider.interface';
import { UserEntity } from '../../../../src/auth/domain/entities/user.entity';
import { UserRole } from '../../../../src/auth/domain/enums/user-role.enum';
import { UserNotFoundFailure } from '../../../../src/auth/domain/failures/auth.failure';
import { FirebaseTokenUnavailableFailure } from '../../../../src/auth/domain/failures/firebase-token.failure';
import { GetCurrentUserParams } from '../../../../src/auth/domain/usecases/get-current-user.params';
import { IssueFirebaseTokenParams } from '../../../../src/auth/domain/usecases/issue-firebase-token.params';
import { IssueFirebaseTokenUseCase } from '../../../../src/auth/domain/usecases/issue-firebase-token.usecase';

/**
 * Unit tests for IssueFirebaseTokenUseCase.
 *
 * Two properties carry the weight of this suite, and both are
 * security-relevant rather than incidental.
 *
 * First, **no token is minted for an account that no longer resolves**.
 * A Firebase session established from a custom token refreshes itself
 * indefinitely and cannot be revoked from here; minting one for a
 * deactivated account would outlive the account. The ordering assertion
 * (repository before provider) is what proves the check is not merely
 * present but actually gating.
 *
 * Second, **the uid comes from the record the database returned**, not
 * from the value carried in the request. The two are equal by
 * construction today; asserting it means a future change that lets them
 * diverge fails here rather than silently granting a Firebase identity
 * under an unverified uid.
 *
 * Both doubles are declared as standalone consts typed via
 * `jest.MockedFunction` against the port method signatures, then
 * assembled into the objects passed to the constructor — the convention
 * `auth.controller.spec.ts` establishes. Asserting against a method
 * reached through its object (`expect(authRepository.getCurrentUser)`)
 * would pass an unbound method to `expect`, which
 * `@typescript-eslint/unbound-method` rejects. As plain functions with
 * no receiver, these consts sidestep the rule rather than suppressing
 * it.
 *
 * @competency Unit test harness, TDD cycle.
 * @competency Test scenarios A-FBT-01, A-FBT-02, A-FBT-03.
 */
describe('IssueFirebaseTokenUseCase', () => {
  let issueFirebaseTokenUseCase: IssueFirebaseTokenUseCase;

  const getCurrentUser: jest.MockedFunction<IAuthRepository['getCurrentUser']> =
    jest.fn();
  const createCustomToken: jest.MockedFunction<
    IFirebaseAuthProvider['createCustomToken']
  > = jest.fn();

  const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

  const VALID_PARAMS = new IssueFirebaseTokenParams({ userId: USER_ID });

  const MOCK_USER = new UserEntity({
    id: USER_ID,
    email: 'test@example.com',
    username: 'testuser',
    role: UserRole.REGISTERED,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  });

  beforeEach(() => {
    getCurrentUser.mockReset();
    createCustomToken.mockReset();

    const authRepository: IAuthRepository = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      getCurrentUser,
    };
    const firebaseAuthProvider: IFirebaseAuthProvider = { createCustomToken };

    issueFirebaseTokenUseCase = new IssueFirebaseTokenUseCase(
      authRepository,
      firebaseAuthProvider,
    );
  });

  describe('execute', () => {
    it('should return the token minted by the provider (A-FBT-01)', async () => {
      getCurrentUser.mockResolvedValue(MOCK_USER);
      createCustomToken.mockResolvedValue('mock.custom.token');

      const result = await issueFirebaseTokenUseCase.execute(VALID_PARAMS);

      expect(result).toBe('mock.custom.token');
    });

    it('should re-resolve the account before minting anything (A-FBT-02)', async () => {
      getCurrentUser.mockResolvedValue(MOCK_USER);
      createCustomToken.mockResolvedValue('mock.custom.token');

      await issueFirebaseTokenUseCase.execute(VALID_PARAMS);

      expect(getCurrentUser).toHaveBeenCalledWith(
        new GetCurrentUserParams({ userId: USER_ID }),
      );
      expect(getCurrentUser.mock.invocationCallOrder[0]).toBeLessThan(
        createCustomToken.mock.invocationCallOrder[0],
      );
    });

    it('should mint no token when the account no longer resolves (A-FBT-02)', async () => {
      getCurrentUser.mockRejectedValue(new UserNotFoundFailure());

      await expect(
        issueFirebaseTokenUseCase.execute(VALID_PARAMS),
      ).rejects.toThrow(UserNotFoundFailure);
      expect(createCustomToken).not.toHaveBeenCalled();
    });

    it('should take the uid from the resolved record, not from the request (A-FBT-03)', async () => {
      // Unreachable over HTTP: @CurrentUser and the repository lookup
      // agree by construction. Asserted so that a change letting them
      // diverge fails here rather than granting a Firebase identity
      // under an unverified uid.
      getCurrentUser.mockResolvedValue(MOCK_USER);
      createCustomToken.mockResolvedValue('mock.custom.token');

      await issueFirebaseTokenUseCase.execute(
        new IssueFirebaseTokenParams({ userId: 'a-different-user-id' }),
      );

      expect(createCustomToken).toHaveBeenCalledWith(USER_ID);
      expect(createCustomToken).toHaveBeenCalledTimes(1);
    });

    it('should propagate FirebaseTokenUnavailableFailure unchanged', async () => {
      getCurrentUser.mockResolvedValue(MOCK_USER);
      createCustomToken.mockRejectedValue(
        new FirebaseTokenUnavailableFailure('credentials rejected'),
      );

      await expect(
        issueFirebaseTokenUseCase.execute(VALID_PARAMS),
      ).rejects.toThrow(FirebaseTokenUnavailableFailure);
    });

    it('should not catch or transform unexpected errors', async () => {
      getCurrentUser.mockRejectedValue(new Error('Database connection lost'));

      await expect(
        issueFirebaseTokenUseCase.execute(VALID_PARAMS),
      ).rejects.toThrow('Database connection lost');
    });
  });
});

describe('IssueFirebaseTokenParams', () => {
  it('should store userId as a readonly field', () => {
    const params = new IssueFirebaseTokenParams({ userId: 'user-id-value' });

    expect(params.userId).toBe('user-id-value');
  });
});

describe('FirebaseTokenUnavailableFailure', () => {
  it('should extend Error with the correct name and preserve the cause', () => {
    const failure = new FirebaseTokenUnavailableFailure('IAM denied');

    expect(failure).toBeInstanceOf(Error);
    expect(failure.name).toBe('FirebaseTokenUnavailableFailure');
    expect(failure.message).toContain('IAM denied');
  });
});
