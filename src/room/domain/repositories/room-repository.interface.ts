import { CreateRoomParams } from '../usecases/create-room.params';
import { UpdateRoomParams } from '../usecases/update-room.params';
import { RoomEntity } from '../entities/room.entity';

/**
 * Repository port for the Room bounded context.
 *
 * This abstract class defines the contract that the domain layer depends
 * on. It is implemented by {@link RoomRepositoryImpl} in the data layer.
 * Using an abstract class (rather than an interface) allows NestJS
 * dependency injection to use it as a provider token, mirroring
 * `IAuthRepository`.
 *
 * Grows incrementally, one method per task — `create()`,
 * `findOwnerId()`, `getPublicRooms()`, and
 * `getById()` are implemented so far. Subsequent
 * tasks will add `update()`, `delete()`,
 * `join()`, and `leave()`.
 *
 * @see RoomRepositoryImpl — data layer implementation
 * @see CreateRoomUseCase — primary consumer of this port
 */
export abstract class IRoomRepository {
  /**
   * Creates a new room and auto-joins its owner as the first active member,
   * within a single transaction.
   *
   * @param params - Validated creation input (owner, name, description, visibility).
   * @returns The persisted {@link RoomEntity}, with `memberCount` set to 1.
   */
  abstract create(params: CreateRoomParams): Promise<RoomEntity>;

  /**
   * Resolves the owner id of a room, for use by {@link OwnershipGuard}.
   *
   * A dedicated lookup rather than a full `getById()` (introduced later):
   * the guard needs only the owner id to authorize the request,
   * not the full aggregate.
   *
   * @param roomId - The room's id, taken from the route parameter.
   * @returns The owner's user id, or `null` if no active (non-deleted)
   *   room exists with this id.
   */
  abstract findOwnerId(roomId: string): Promise<string | null>;

  /**
   * Returns every active (non-deleted), public room, each annotated with
   * its current active member count.
   *
   * @returns An array of {@link RoomEntity}, ordered most recently
   *   created first. Empty array if no public rooms exist.
   */
  abstract getPublicRooms(): Promise<RoomEntity[]>;

  /**
   * Retrieves a single active (non-deleted) room by id, with its current
   * active member count.
   *
   * Unlike {@link findOwnerId}, this returns the full aggregate rather
   * than just the owner id — it backs the `GET /rooms/:id` detail
   * endpoint, not the ownership guard.
   *
   * Does **not** yet include the room's current video session: the
   * `video_sessions` table is introduced later, in
   * Video Synchronisation bounded context.
   * Extending this method's
   * return shape at that point is an explicit, tracked follow-up rather
   * than an oversight here.
   *
   * @param roomId - The room's id.
   * @returns The requested {@link RoomEntity}.
   * @throws {@link RoomNotFoundFailure} if no active room exists with this id.
   */
  abstract getById(roomId: string): Promise<RoomEntity>;

  /**
   * Updates a room's name and/or description.
   *
   * Ownership is not re-checked here: by the time this method is called,
   * `OwnershipGuard` has already authorized the request at the
   * presentation layer. This method only re-verifies *existence* (the
   * room could in principle have been deleted between the guard's check
   * and this call), which is why it can still throw
   * {@link RoomNotFoundFailure}.
   *
   * @param params - The room id and the fields to update (partial).
   * @returns The updated {@link RoomEntity}, with a freshly computed member count.
   * @throws {@link RoomNotFoundFailure} if no active room exists with this id.
   */
  abstract update(params: UpdateRoomParams): Promise<RoomEntity>;

  /**
   * Soft-deletes a room (sets `deleted_at`), preserving its
   * `room_memberships` history for audit purposes.
   *
   * Ownership is not re-checked here — see {@link update} for the same
   * rationale. Also covers the "already deleted" case defensively,
   * although in practice `OwnershipGuard` (whose `findOwnerId` lookup
   * excludes soft-deleted rows) already rejects a second delete attempt
   * with 404 before this method is ever called.
   *
   * @param roomId - The room's id.
   * @throws {@link RoomNotFoundFailure} if no active room exists with this id.
   */
  abstract delete(roomId: string): Promise<void>;

  /**
   * Creates an active membership for a user in a room.
   *
   * @param roomId - The room's id.
   * @param userId - The joining user's id.
   * @returns The room, with a freshly computed active member count.
   * @throws {@link RoomNotFoundFailure} if no active room exists with this id.
   * @throws {@link RoomAlreadyJoinedFailure} if the user already holds an
   *   active membership in this room (the partial unique index on
   *   `room_memberships` permits a *new* row once a prior one has
   *   `left_at` set — this failure only fires for a genuine duplicate
   *   active membership).
   */
  abstract join(roomId: string, userId: string): Promise<RoomEntity>;
}
