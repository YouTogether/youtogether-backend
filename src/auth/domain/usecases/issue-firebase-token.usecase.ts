import { Injectable } from '@nestjs/common';

import { IAuthRepository } from '../repositories/auth-repository.interface';
import { IFirebaseAuthProvider } from '../repositories/firebase-auth-provider.interface';
import { GetCurrentUserParams } from './get-current-user.params';
import { IssueFirebaseTokenParams } from './issue-firebase-token.params';

/**
 * Issues a Firebase custom token for the authenticated user, so the
 * Flutter client can establish a Firebase session whose `auth.uid` is
 * this application's own user UUID.
 *
 * ## Why the freshness check
 * Unlike {@link LogoutUseCase}, this use case does not simply trust the
 * validated access token. It re-resolves the account through
 * {@link IAuthRepository.getCurrentUser} first, and only mints a token
 * if that succeeds.
 *
 * The reason is the asymmetry in session lifetimes. An access token
 * lasts fifteen minutes. A Firebase session established from a custom
 * token refreshes itself indefinitely and no longer depends on this
 * backend at all — there is no revocation path short of rotating the
 * service account. Minting one on the strength of a token issued
 * moments before an account was deactivated would grant Realtime
 * Database write access that outlives the account itself.
 *
 * The cost is one indexed lookup per session, on a call the client makes
 * once at sign-in rather than per request. `UserNotFoundFailure`
 * propagates unchanged and `DomainExceptionFilter` maps it to 401,
 * exactly as for `GET /auth/me`.
 *
 * ## What this use case does not do
 * It does not create, read or revoke Firebase users, and it never treats
 * Firebase as a source of identity. It asserts to Firebase an identity
 * this backend already established. Anonymous viewers obtain a Firebase
 * identity through `signInAnonymously` on the client and never reach
 * this endpoint at all — they have no account here to assert.
 *
 * @competency Access control anchored in persisted state (OWASP A01:2021)
 * @see IFirebaseAuthProvider — the delegated port
 */
@Injectable()
export class IssueFirebaseTokenUseCase {
  constructor(
    private readonly authRepository: IAuthRepository,
    private readonly firebaseAuthProvider: IFirebaseAuthProvider,
  ) {}

  /**
   * @param params - Carries the userId resolved from the validated
   *   access token, never from client input.
   * @returns A single-use Firebase custom token.
   * @throws {UserNotFoundFailure} if the account no longer resolves to
   *   an active user, mapped to 401 by `DomainExceptionFilter`.
   * @throws {FirebaseTokenUnavailableFailure} if the token could not be
   *   signed.
   */
  async execute(params: IssueFirebaseTokenParams): Promise<string> {
    const user = await this.authRepository.getCurrentUser(
      new GetCurrentUserParams({ userId: params.userId }),
    );

    // Deliberately `user.id` rather than `params.userId`, even though
    // the two are equal by construction. The uid written into the token
    // is what the Realtime Database rules will authorise against, so it
    // is taken from the record the database just returned rather than
    // from a value that travelled through the request.
    return this.firebaseAuthProvider.createCustomToken(user.id);
  }
}
