/**
 * Domain entity representing a Room in the Room bounded context.
 *
 * This class is the aggregate root for a broadcast group. It is a plain
 * TypeScript object with no ORM decorators, no framework imports, and no
 * infrastructure concerns — mirroring `UserEntity`.
 *
 * `memberCount` is a computed, read-only projection (count of active
 * `room_memberships` rows), not a persisted column. It is always 1 at
 * creation time (the owner is auto-joined) and recomputed by the data
 * layer for listing/detail queries in later tasks.
 */
export class RoomEntity {
  /** Universally unique identifier (UUID v4). */
  readonly id: string;

  /** Public display name of the room. */
  readonly name: string;

  /** Optional short description. */
  readonly description: string | null;

  /** Identifier of the user who created and owns this room. */
  readonly ownerId: string;

  /** Whether the room appears in the public listing. */
  readonly isPublic: boolean;

  /** Number of currently active members (left_at IS NULL). */
  readonly memberCount: number;

  /** Room creation timestamp. */
  readonly createdAt: Date;

  /** Last modification timestamp. */
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    name: string;
    description: string | null;
    ownerId: string;
    isPublic: boolean;
    memberCount: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.description = params.description;
    this.ownerId = params.ownerId;
    this.isPublic = params.isPublic;
    this.memberCount = params.memberCount;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }
}
