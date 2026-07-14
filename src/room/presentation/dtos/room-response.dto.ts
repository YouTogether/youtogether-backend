import { RoomEntity } from '../../domain/entities/room.entity';

/**
 * HTTP response body shape for Room endpoints (POST /rooms, and
 * subsequent GET/PATCH endpoints in later Sprint 2 tasks).
 *
 * Shape aligns with the frontend `RoomEntity` (Interface Contracts v1.1).
 *
 * @see RoomController.create
 */
export class RoomResponseDto {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly ownerId: string,
    public readonly isPublic: boolean,
    public readonly memberCount: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  /**
   * Builds a {@link RoomResponseDto} from a domain {@link RoomEntity}.
   */
  static fromRoomEntity(room: RoomEntity): RoomResponseDto {
    return new RoomResponseDto(
      room.id,
      room.name,
      room.description,
      room.ownerId,
      room.isPublic,
      room.memberCount,
      room.createdAt,
      room.updatedAt,
    );
  }
}
