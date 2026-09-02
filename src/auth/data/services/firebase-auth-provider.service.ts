import { Injectable } from '@nestjs/common';

import { FirebaseAdminService } from '../../../firebase/firebase-admin.service';
import { FirebaseTokenUnavailableFailure } from '../../domain/failures/firebase-token.failure';
import { IFirebaseAuthProvider } from '../../domain/repositories/firebase-auth-provider.interface';

/**
 * Data layer implementation of {@link IFirebaseAuthProvider}, backed by
 * the Firebase Admin SDK through {@link FirebaseAdminService}.
 *
 * Mirrors `FirebaseRealtimeStateService` in the Video Synchronisation
 * context: a thin adapter that wraps one SDK call and translates its
 * failure mode into a domain failure, so nothing above this layer
 * imports `firebase-admin`.
 *
 * ## No custom claims
 * `createCustomToken` accepts an optional claims object, deliberately
 * left unused. Claims embedded in a custom token are copied into the
 * Firebase session and survive its automatic refreshes indefinitely,
 * with no revocation path short of rotating the service account. Room
 * ownership changes; a claim asserting it would not. The Realtime
 * Database rules therefore read `leader_id` from the database itself
 * and compare it against `auth.uid`, so the only thing this token needs
 * to assert is identity.
 *
 * @see IFirebaseAuthProvider — the domain port being implemented
 * @competency Secure integration with an external identity provider
 */
@Injectable()
export class FirebaseAuthProviderService implements IFirebaseAuthProvider {
  constructor(private readonly firebaseAdminService: FirebaseAdminService) {}

  /**
   * @param userId - Used verbatim as the Firebase `uid`.
   * @throws {FirebaseTokenUnavailableFailure} on any SDK, credential or
   *   network error, mapped to HTTP 502 by `DomainExceptionFilter`.
   */
  async createCustomToken(userId: string): Promise<string> {
    try {
      return await this.firebaseAdminService.auth.createCustomToken(userId);
    } catch (error) {
      // The cause is preserved in the message for the server logs, but
      // never the uid or anything derived from the service account.
      throw new FirebaseTokenUnavailableFailure(
        error instanceof Error ? error.message : 'unknown error',
      );
    }
  }
}
