import { FirebaseAdminService } from '../../../../src/firebase/firebase-admin.service';
import { FirebaseAuthProviderService } from '../../../../src/auth/data/services/firebase-auth-provider.service';
import { FirebaseTokenUnavailableFailure } from '../../../../src/auth/domain/failures/firebase-token.failure';

/**
 * Unit tests for FirebaseAuthProviderService.
 *
 * The Admin SDK is stubbed at the {@link FirebaseAdminService} boundary
 * rather than mocked module-wide with `jest.mock`, mirroring
 * `firebase-realtime-state.service.spec.ts`.
 *
 * The "no custom claims" assertion is not stylistic. Claims embedded in
 * a custom token are copied into the Firebase session and survive its
 * automatic refreshes with no revocation path short of rotating the
 * service account. Room ownership changes; a claim asserting it would
 * not. Adding one later would be a silent, hard-to-detect regression,
 * so it is pinned here.
 *
 * @competency Unit test harness, TDD cycle.
 * @competency Test scenarios A-FBT-01, A-FBT-04.
 */
describe('FirebaseAuthProviderService', () => {
  let service: FirebaseAuthProviderService;

  const createCustomTokenMock = jest.fn();

  const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    createCustomTokenMock.mockReset();
    createCustomTokenMock.mockResolvedValue('mock.custom.token');

    const firebaseAdminService = {
      auth: { createCustomToken: createCustomTokenMock },
    } as unknown as FirebaseAdminService;

    service = new FirebaseAuthProviderService(firebaseAdminService);
  });

  it('should return the token produced by the SDK (A-FBT-01)', async () => {
    const result = await service.createCustomToken(USER_ID);

    expect(result).toBe('mock.custom.token');
  });

  it("should use the application's user id verbatim as the Firebase uid", async () => {
    await service.createCustomToken(USER_ID);

    expect(createCustomTokenMock).toHaveBeenCalledWith(USER_ID);
    expect(createCustomTokenMock).toHaveBeenCalledTimes(1);
  });

  it('should attach no custom claims', async () => {
    await service.createCustomToken(USER_ID);

    // Exactly one argument. A second one would be a claims object.
    expect(createCustomTokenMock.mock.calls[0]).toHaveLength(1);
  });

  it('should wrap a rejected call in FirebaseTokenUnavailableFailure (A-FBT-04)', async () => {
    createCustomTokenMock.mockRejectedValue(
      new Error('Permission iam.serviceAccounts.signBlob is required'),
    );

    await expect(service.createCustomToken(USER_ID)).rejects.toThrow(
      FirebaseTokenUnavailableFailure,
    );
  });

  it('should preserve the underlying cause in the failure message', async () => {
    createCustomTokenMock.mockRejectedValue(
      new Error('Permission iam.serviceAccounts.signBlob is required'),
    );

    await expect(service.createCustomToken(USER_ID)).rejects.toThrow(
      /signBlob/,
    );
  });

  it('should not leak the uid into the failure message', async () => {
    createCustomTokenMock.mockRejectedValue(new Error('credentials rejected'));

    await expect(service.createCustomToken(USER_ID)).rejects.not.toThrow(
      new RegExp(USER_ID),
    );
  });

  it('should not leak a non-Error rejection value into the message', async () => {
    createCustomTokenMock.mockRejectedValue('some string');

    await expect(service.createCustomToken(USER_ID)).rejects.toThrow(
      /unknown error/,
    );
  });
});
