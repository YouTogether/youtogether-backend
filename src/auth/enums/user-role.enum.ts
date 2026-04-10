/**
 * Enum representing the possible roles for a User entity.
 *
 * - `REGISTERED`: Authenticated user with full access (video control, room management).
 * - `GUEST`: Unauthenticated visitor with read-only access; no video-control capabilities.
 */
export enum UserRole {
  REGISTERED = 'registered',
  GUEST = 'guest',
}
