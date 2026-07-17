/**
 * Thrown by the room repository when a room lookup by id resolves to no
 * active (non-deleted) row.
 *
 * A single failure covers both "the id never existed" and "the room was
 * soft-deleted": from the caller's perspective the outcome is identical
 * (404), mirroring how `UserNotFoundFailure` does not distinguish "never
 * registered" from "deleted after token issuance".
 *
 * The presentation layer maps this failure to HTTP 404 Not Found via
 * {@link RoomExceptionFilter}.
 *
 * @see IRoomRepository.getById
 * @see RoomExceptionFilter
 */
export class RoomNotFoundFailure extends Error {
  readonly roomId: string;

  constructor(roomId: string) {
    super(`Room with id "${roomId}" was not found.`);
    this.name = 'RoomNotFoundFailure';
    this.roomId = roomId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a user attempts to join a room they already hold an
 * *active* membership in (`left_at IS NULL`).
 *
 * Rejoining after having left is explicitly allowed (see the partial
 * unique index on `room_memberships`) — this failure
 * only fires for a genuinely duplicate *active* membership.
 *
 * The presentation layer maps this failure to HTTP 409 Conflict via
 * {@link RoomExceptionFilter}.
 *
 * @see IRoomRepository.join
 * @see RoomExceptionFilter
 */
export class RoomAlreadyJoinedFailure extends Error {
  readonly roomId: string;
  readonly userId: string;

  constructor(roomId: string, userId: string) {
    super(
      `User "${userId}" already has an active membership in room "${roomId}".`,
    );
    this.name = 'RoomAlreadyJoinedFailure';
    this.roomId = roomId;
    this.userId = userId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
