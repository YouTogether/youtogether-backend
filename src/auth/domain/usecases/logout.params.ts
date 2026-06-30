/**
 * Value object encapsulating the parameter required to terminate a session.
 *
 * The userId is never taken from client input — it is resolved by
 * {@link JwtAuthGuard} / {@link JwtStrategy} from the validated access
 * token's `sub` claim and injected via the {@link CurrentUser} decorator.
 * A user can therefore only ever log themselves out.
 *
 * @see LogoutUseCase
 * @see AuthController.logout
 */
export class LogoutParams {
  /** UUID of the currently authenticated user. */
  readonly userId: string;

  constructor(params: { userId: string }) {
    this.userId = params.userId;
  }
}
