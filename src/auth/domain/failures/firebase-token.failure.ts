/**
 * Thrown when a Firebase custom token could not be signed (service
 * account credentials rejected, IAM permission missing, Google's token
 * signing endpoint unreachable).
 *
 * Declared in its own file rather than appended to `auth.failure.ts`.
 * The failures in that file all describe the *application's own* auth
 * domain — credentials, refresh tokens, account state. This one
 * describes a third-party integration failing, and belongs with the
 * concern it names rather than with a set it does not resemble.
 *
 * `DomainExceptionFilter` maps it to HTTP 502 Bad Gateway, matching how
 * the Video Synchronisation context treats
 * `YoutubeApiUnavailableFailure` and `RealtimeStateUnavailableFailure`:
 * the request was well-formed and authenticated, but an upstream
 * dependency could not fulfil it. A 500 would be wrong — nothing in
 * this application is broken — and a 401 would be actively misleading,
 * since the client's own credentials are valid and re-authenticating
 * would not help.
 *
 * The client's correct response is to retry shortly. Until it succeeds,
 * the user has a valid application session but no Firebase identity,
 * and the Realtime Database rules will refuse their writes.
 *
 * @see IFirebaseAuthProvider.createCustomToken
 * @see DomainExceptionFilter
 */
export class FirebaseTokenUnavailableFailure extends Error {
  constructor(cause: string) {
    super(`A Firebase custom token could not be issued: ${cause}`);
    this.name = 'FirebaseTokenUnavailableFailure';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
