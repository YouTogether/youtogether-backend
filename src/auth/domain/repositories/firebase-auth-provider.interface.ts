/**
 * Domain port for minting Firebase custom tokens.
 *
 * Declared as an abstract class rather than an interface so it can serve
 * as a NestJS injection token, mirroring {@link IAuthRepository} and
 * `IRealtimeStateWriter`.
 *
 * ## Why this port exists
 * The application does not use Firebase Authentication: identity is
 * owned by this backend and carried by its own JWTs. Clients therefore
 * reach the Realtime Database with `auth === null`, which makes every
 * identity-based security rule unwritable — `leader_id` cannot be
 * compared against `auth.uid` if there is no `auth.uid`.
 *
 * A custom token closes that gap. The backend signs an assertion that a
 * given uid is authentic; the client exchanges it for a Firebase
 * session whose `auth.uid` is the application's own user UUID. Client
 * gating and server enforcement then agree by construction, since
 * `playback_state.leader_id` is written from the room's `ownerId`
 * (B-V03) and both are the same identifier space.
 *
 * ## Deliberately narrow
 * One method. This port is not a general Firebase Authentication
 * facade: the backend never reads Firebase users, never revokes
 * sessions, and never treats Firebase as a source of identity. It only
 * asserts, to Firebase, an identity it already established itself.
 *
 * @see FirebaseAuthProviderService — the data layer implementation
 * @see IssueFirebaseTokenUseCase — the sole consumer
 */
export abstract class IFirebaseAuthProvider {
  /**
   * Mints a Firebase custom token for [userId].
   *
   * The returned token is single-use and short-lived (one hour, fixed by
   * Firebase). Once exchanged via `signInWithCustomToken`, the resulting
   * Firebase session refreshes itself and no longer depends on this
   * backend — which is exactly why
   * {@link IssueFirebaseTokenUseCase} verifies the account is still
   * active before calling this method.
   *
   * @param userId - The application's user UUID, used verbatim as the
   *   Firebase `uid`. Never a client-supplied value.
   * @throws {FirebaseTokenUnavailableFailure} if the token could not be
   *   signed.
   */
  abstract createCustomToken(userId: string): Promise<string>;
}
