import { ApiProperty } from '@nestjs/swagger';

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
    @ApiProperty({ example: '7b2e6b0a-2f2a-4b6a-8e2a-1a2b3c4d5e6f' })
    public readonly id: string,
    @ApiProperty({ example: 'Friday Movie Night' })
    public readonly name: string,
    @ApiProperty({ example: 'Weekly watch party', nullable: true })
    public readonly description: string | null,
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
    public readonly ownerId: string,
    @ApiProperty({ example: true })
    public readonly isPublic: boolean,
    @ApiProperty({ example: 3 })
    public readonly memberCount: number,
    @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
    public readonly createdAt: Date,
    @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
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
