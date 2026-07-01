/**
 * Value object encapsulating the parameter required to fetch the current
 * user's profile.
 *
 * The userId is never taken from client input — it is resolved by
 * {@link JwtAuthGuard} / {@link JwtStrategy} from the validated access
 * token's `sub` claim and injected via the {@link CurrentUser} decorator.
 *
 * @see GetCurrentUserUseCase
 * @see AuthController.me
 */
export class GetCurrentUserParams {
  /** UUID of the currently authenticated user. */
  readonly userId: string;

  constructor(params: { userId: string }) {
    this.userId = params.userId;
  }
}
