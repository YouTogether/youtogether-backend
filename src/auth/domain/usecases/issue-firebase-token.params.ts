/**
 * Value object encapsulating the parameter required to issue a Firebase
 * custom token.
 *
 * The userId is never taken from client input — it is resolved by
 * {@link JwtAuthGuard} / {@link JwtStrategy} from the validated access
 * token's `sub` claim and injected via the {@link CurrentUser}
 * decorator. A user can therefore only ever obtain a Firebase identity
 * for themselves.
 *
 * That constraint matters more here than in {@link LogoutParams} or
 * {@link GetCurrentUserParams}: the resulting token grants write access
 * to the Realtime Database under this uid, and the security rules
 * authorize playback commands by comparing `auth.uid` against the
 * room's `leader_id`. A client-supplied userId would be a direct path
 * to impersonating a room's leader.
 *
 * @see IssueFirebaseTokenUseCase
 * @see AuthController.firebaseToken
 */
export class IssueFirebaseTokenParams {
  /** UUID of the currently authenticated user. */
  readonly userId: string;

  constructor(params: { userId: string }) {
    this.userId = params.userId;
  }
}
