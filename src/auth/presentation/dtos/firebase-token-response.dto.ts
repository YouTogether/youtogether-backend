import { ApiProperty } from '@nestjs/swagger';

/**
 * Response body of `POST /auth/firebase-token`.
 *
 * Carries the custom token and nothing else. In particular, it does not
 * echo the uid: the client already knows who it is, and a response body
 * that names the identity a credential grants makes that credential
 * easier to misuse if it is ever logged or leaked.
 *
 * No expiry field either. A custom token is valid for one hour, fixed
 * by Firebase and not configurable, but the client consumes it
 * immediately via `signInWithCustomToken` and never stores it — the
 * Firebase session that follows manages its own refreshes. Publishing a
 * TTL would invite a client to cache a credential it has no reason to
 * keep.
 *
 * @see AuthController.firebaseToken
 */
export class FirebaseTokenResponseDto {
  @ApiProperty({
    description:
      'Single-use Firebase custom token. Exchange it immediately via ' +
      'signInWithCustomToken; do not store it.',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  readonly firebaseToken: string;

  constructor(params: { firebaseToken: string }) {
    this.firebaseToken = params.firebaseToken;
  }

  static fromToken(firebaseToken: string): FirebaseTokenResponseDto {
    return new FirebaseTokenResponseDto({ firebaseToken });
  }
}
