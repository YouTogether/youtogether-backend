import { CreateRoomParams } from '../usecases/create-room.params';
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
 * Grows incrementally, one method per task — `create()` is the only
 * method required.
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
}
